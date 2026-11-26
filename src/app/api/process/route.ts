import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uploadToGemini, deleteFileFromGemini } from "@/lib/gemini";
import { isSafeId } from "@/lib/path-utils";
import { isUploadCancelled } from "@/lib/upload-cancellations";
import { resolveMediaMimeType } from "@/lib/upload-utils";
import { extractAudio, getAudioCodec, ffprobe } from "@/lib/ffmpeg-utils";
import { describeGaps, LONG_MEDIA_SECONDS } from "@/lib/chunked-generation";
import fs from "fs";
import path from "path";
import { getStorageConfig, isPathSafe } from "@/lib/storage-config";
import { v4 as uuidv4 } from "uuid";
import busboy from "busboy";
import { Readable } from "stream";
import { secureDelete } from "@/lib/security";
import { describeError } from "@/lib/error-utils";
import { validateAuth } from "@/lib/auth";
import { SubtitleLine } from "@/types/subtitle";
import { DEFAULT_AI_MODEL } from "@/types/constants";
import { CompletedUpload, takeCompletedUpload, UploadSessionError } from "@/lib/upload-sessions";
// fluent-ffmpeg removed - using native child_process in ffmpeg-utils

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

// Next.js config for this specific route
export const dynamic = 'force-dynamic';


const ALLOWED_LANGUAGES = [
  "Simplified Chinese", 
  "Traditional Chinese",
  "Spanish", 
  "French", 
  "Japanese", 
  "German", 
  "Russian", 
  "Dutch", 
  "Ukrainian", 
  "Arabic",
  "English",
  "Korean",
  "Italian",
  "Portuguese"
];

export async function POST(req: NextRequest) {
  // Security check: enforce authentication
  if (!validateAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Handle JSON requests for Reprocessing/Translation
  if (req.headers.get("content-type")?.includes("application/json")) {
    try {
      const body = await req.json();
      
      const ReprocessSchema = z.object({
        mode: z.literal('reprocess'),
        fileUri: z.string().optional(),
        filePath: z.string().optional(),
        language: z.string().optional(),
        secondaryLanguage: z.string().optional(),
        model: z.string().optional(),
        clipId: z.string().optional(),
        sampleDuration: z.number().optional(),
        promptHints: z.string().optional().refine(val => !val || val.length <= 1000, { message: "Prompt hints cannot exceed 1000 characters" }),
      }).refine(data => data.fileUri || data.filePath, { message: "Either fileUri or filePath is required" });

      const SubtitleLineSchema = z.object({
        id: z.string(),
        startTime: z.number(),
        endTime: z.number(),
        text: z.string(),
        secondaryText: z.string().optional(),
        clipId: z.string().optional(),
      }).passthrough();

      const TranslateSchema = z.object({
        mode: z.literal('translate'),
        subtitles: z.array(SubtitleLineSchema).max(5000),
        secondaryLanguage: z.string(),
        model: z.string().optional(),
        clipId: z.string().optional(),
      });

      // A file sent in pieces through /api/upload, now complete
      const UploadedSchema = z.object({
        mode: z.literal('uploaded'),
        uploadId: z.string().refine(isSafeId, { message: "Invalid upload id" }),
        secondaryLanguage: z.string().optional(),
        model: z.string().optional(),
      });

      const Schema = z.discriminatedUnion('mode', [ReprocessSchema, TranslateSchema, UploadedSchema]);

      const validation = Schema.safeParse(body);

      if (!validation.success) {
         return NextResponse.json({ error: "Invalid request data", details: validation.error.format() }, { status: 400 });
      }

      if (validation.data.mode === 'uploaded') {
         const { uploadId, secondaryLanguage, model } = validation.data;
         let upload: CompletedUpload;
         try {
           upload = await takeCompletedUpload(uploadId);
         } catch (error) {
           if (error instanceof UploadSessionError) {
             return NextResponse.json({ error: error.message, received: error.received }, { status: error.status });
           }
           throw error;
         }
         return processStoredUpload({
           videoPath: upload.path,
           originalFilename: upload.filename,
           mimeType: upload.mimeType,
           secondaryLanguage: secondaryLanguage ?? "None",
           modelName: model || DEFAULT_AI_MODEL,
           uploadId,
         });
      }

      const { mode, fileUri, filePath, language, secondaryLanguage, subtitles, model: modelName, clipId, sampleDuration, promptHints } = validation.data as {
        mode: 'reprocess' | 'translate';
        fileUri?: string;
        filePath?: string;
        language?: string;
        secondaryLanguage?: string;
        subtitles?: SubtitleLine[];
        model?: string;
        clipId?: string;
        sampleDuration?: number;
        promptHints?: string;
      };

      if (mode === 'reprocess') {
         // We need either a Gemini URI or a local File Path
         if (!fileUri && !filePath) {
             return NextResponse.json({ error: "No fileUri or filePath provided" }, { status: 400 });
         }

         const { getGlobalSettings } = await import("@/lib/global-settings-store");
         const { processWithFallback } = await import("@/lib/ai-provider");
         const settings = getGlobalSettings();
         const config = getStorageConfig();
         const secondary = secondaryLanguage && secondaryLanguage !== "None" ? secondaryLanguage : undefined;

         if (filePath) {
             // Security check: strict path validation for local files
             if (!isPathSafe(filePath)) {
                 console.warn(`[Process] Blocked unauthorized path access: ${filePath}`);
                 return NextResponse.json({ error: 'Unauthorized path' }, { status: 403 });
             }
             if (!fs.existsSync(filePath)) {
                 return NextResponse.json({ error: "The video file is missing from the server" }, { status: 404 });
             }

             // Transcribe from the local file as audio pieces: works for any length
             // (no output cap, no Files API upload that expires after 48 hours).
             // A preview only transcribes the first `sampleDuration` seconds.
             const info = await ffprobe(filePath);
             const duration = sampleDuration ? Math.min(sampleDuration, info.duration || sampleDuration) : info.duration;
             const label = `${path.basename(filePath)}${sampleDuration ? ` (${sampleDuration}s preview)` : ""}`;
             console.log(`[Process] Reprocessing ${label} with ${modelName ?? "default model"}`);

             const { transcribeAudio } = await import("@/lib/audio-transcription");
             const result = await transcribeAudio({
                 sourcePath: filePath,
                 duration,
                 workDir: path.join(config.stagingDir, 'temp'),
                 secondaryLanguage: secondary,
                 modelName,
                 promptHints,
                 fallbackChain: settings.aiFallbackChain,
                 label,
             });
             const subtitleWarning = result.gaps.length > 0 ? describeGaps(result.gaps) : undefined;
             if (subtitleWarning) console.warn(`[Process] ${label}: ${subtitleWarning}`);

             return NextResponse.json({
                 subtitles: result.subtitles,
                 detectedLanguage: result.detectedLanguage,
                 clipId,
                 ...(subtitleWarning && { subtitleWarning }),
             });
         }

         // No local file: transcribe a file already uploaded to Gemini (expires after 48 hours)
         console.log(`Reprocessing with URI: ${fileUri}, Lang: ${language}`);
         const result = await processWithFallback(
           'generate',
           { fileUri, mimeType: "video/mp4", secondaryLanguage: secondary, modelName, promptHints },
           settings.aiFallbackChain
         );
         return NextResponse.json({ ...result, clipId, geminiFileUri: fileUri });

      } else if (mode === 'translate') {
         if (!subtitles) return NextResponse.json({ error: "No subtitles provided" }, { status: 400 });
         
         const { getGlobalSettings } = await import("@/lib/global-settings-store");
         const { processWithFallback } = await import("@/lib/ai-provider");
         const settings = getGlobalSettings();
         
         console.log(`Retranslating to: ${secondaryLanguage} with ${modelName ?? "the fallback chain"}`);
         const result = await processWithFallback(
           'translate',
           { subtitles, targetLanguage: secondaryLanguage, modelName },
           settings.aiFallbackChain
         );
         
         return NextResponse.json({ subtitles: result.subtitles, clipId });
      }
      
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });

    } catch (e) {
      console.error("API Error:", e);
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  // Handle Multipart Upload (Existing Logic + Meta Return)
  console.log("Processing POST request to /api/process (Streamed via Busboy)");

  let videoPath = ""; // Hoisted for error cleanup
  let originalFilename = "";

  try {
    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Content-Type must be multipart/form-data" }, { status: 400 });
    }

    const config = getStorageConfig();
    const tempDir = path.join(config.stagingDir, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    // videoPath declared outside try block
    let mimeType = "";
    let secondaryLanguage = "Simplified Chinese";
    let modelName = "gemini-3.8-flash";
    let uploadId: string | null = null;

    // Resolve the per-file size limit up front so we can abort mid-stream
    // rather than writing the entire (potentially huge) upload to disk first.
    const { getGlobalSettings: getSettings } = await import("@/lib/global-settings-store");
    const uploadSettings = getSettings();
    const maxFileSizeMB = uploadSettings.maxFileSizeMB ?? 51200; // Default: 50 GB
    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
    let sizeExceeded = false;

    // We need to wait for BOTH busboy to finish parsing AND the file write stream to finish writing.
    const fileWritePromise = new Promise<void>((resolve, reject) => {
       const bb = busboy({ headers: { "content-type": contentType } });

       bb.on("file", (name, file, info) => {
        if (name === "video") {
          const { filename, mimeType: fileMime } = info;
          mimeType = resolveMediaMimeType(filename, fileMime);
          originalFilename = filename;

          const ext = filename.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || "tmp";
          videoPath = path.join(tempDir, `${uuidv4()}.${ext}`);
          console.log(`Streaming file to ${videoPath}`);

          const writeStream = fs.createWriteStream(videoPath);

          // Enforce the size limit as bytes arrive; abort the moment it's exceeded.
          let bytesWritten = 0;
          file.on("data", (chunk: Buffer) => {
            bytesWritten += chunk.length;
            if (!sizeExceeded && bytesWritten > maxFileSizeBytes) {
              sizeExceeded = true;
              file.unpipe(writeStream);
              writeStream.destroy();
              file.resume(); // drain the rest without buffering
              bb.destroy();
              reject(new Error("FILE_TOO_LARGE"));
            }
          });

          file.pipe(writeStream);

          writeStream.on("error", (err) => {
            if (!sizeExceeded) reject(err);
          });
          writeStream.on("finish", () => {
             console.log("Write stream finished.");
             resolve();
          });
        } else {
          file.resume();
        }
      });

      bb.on("field", (name, val) => {
        if (name === "secondaryLanguage") secondaryLanguage = val;
        if (name === "model") modelName = val;
        if (name === "uploadId" && isSafeId(val)) uploadId = val;
      });
      
      // If busboy finishes but we never got a file, we might hang if we rely only on writeStream.finish
      // ensuring we handle errors properly.
      bb.on("error", reject);
      
      // @ts-expect-error req.body Web ReadableStream is compatible with Readable.fromWeb at runtime
      const nodeStream = Readable.fromWeb(req.body);
      nodeStream.pipe(bb);
    });
    
    try {
      await fileWritePromise;
    } catch (err) {
      if (sizeExceeded || (err instanceof Error && err.message === "FILE_TOO_LARGE")) {
        console.warn(`[Process] Upload aborted: exceeded ${maxFileSizeMB} MB limit`);
        if (videoPath && fs.existsSync(videoPath)) {
          secureDelete(videoPath).catch(e => console.error("Cleanup error", e));
        }
        return NextResponse.json(
          { error: `File too large. Maximum allowed: ${maxFileSizeMB} MB. Adjust in Global Settings.` },
          { status: 413 }
        );
      }
      throw err;
    }

    if (!videoPath) {
        return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }
    
    // Safety Check: Verify file exists and has size > 0
    if (!fs.existsSync(videoPath) || fs.statSync(videoPath).size === 0) {
         console.error(`File upload failed: ${videoPath} is empty or missing.`);
         return NextResponse.json({ error: "File upload failed (empty file)" }, { status: 400 });
    }
    
    // Note: the per-file size limit is enforced mid-stream above; no post-write check needed.
    return processStoredUpload({ videoPath, originalFilename, mimeType, secondaryLanguage, modelName, uploadId });

  } catch (error) {
    // Typically the browser disconnecting mid-upload ("Unexpected end of form")
    console.error(`[Process] Upload of ${originalFilename || "(unnamed file)"} failed before processing: ${describeError(error)}`);
    if (videoPath && fs.existsSync(videoPath)) {
      secureDelete(videoPath).catch(e => console.error("Failed to cleanup partial upload:", e));
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to process video" }, { status: 500 });
  }
}

/** A complete upload on disk, from either upload path, ready to be transcribed */
interface StoredUpload {
  videoPath: string;
  originalFilename: string;
  mimeType: string;
  secondaryLanguage: string;
  modelName: string;
  /** Lets Cancel (/api/process/cancel) discard the result if the page goes away */
  uploadId: string | null;
}

/**
 * Transcribes an uploaded file, streaming progress and the result as NDJSON.
 * Shared by the one-request multipart upload and resumable uploads (mode "uploaded").
 */
function processStoredUpload(upload: StoredUpload): NextResponse {
  const { videoPath, originalFilename, secondaryLanguage, modelName, uploadId } = upload;
  let mimeType = upload.mimeType;

  if (secondaryLanguage && secondaryLanguage !== "None" && !ALLOWED_LANGUAGES.includes(secondaryLanguage)) {
    if (secondaryLanguage.trim() !== "") {
      secureDelete(videoPath).catch(e => console.error("Cleanup error", e));
      return NextResponse.json({ error: "Invalid secondary language" }, { status: 400 });
    }
  }

  try {
    const stats = fs.statSync(videoPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    console.log(`File uploaded: ${videoPath}, Size: ${fileSizeInMB.toFixed(2)}MB`);
    const stagingDir = path.join(getStorageConfig().stagingDir, 'temp');
    const INLINE_SIZE_LIMIT_MB = 95; // New limit: 100MB base64, use 95MB raw for safety margin

    // Use streaming response for progress feedback.
    // The browser may go away mid-job (phone asleep, tab closed, network drop).
    // Processing carries on and the result is saved as a draft, unless the
    // user pressed Cancel (reported via /api/process/cancel), which discards it.
    let clientGone = false;
    const noteClientGone = () => {
      if (clientGone) return;
      clientGone = true;
      // Whether to keep or discard the result is decided once processing ends,
      // since a cancel request may arrive just after the disconnect
      console.warn(`[Process] Client disconnected while processing ${originalFilename}; continuing in the background`);
    };
    const discardCancelled = (stage: string, processPath: string, geminiFileId?: string | null) => {
      console.log(`[Process] Discarding cancelled upload ${originalFilename} (${stage})`);
      secureDelete(videoPath).catch(err => console.error("Failed to cleanup temp video:", err));
      if (processPath !== videoPath && fs.existsSync(processPath)) {
        secureDelete(processPath).catch(err => console.error("Failed to cleanup extracted audio:", err));
      }
      if (geminiFileId) deleteFileFromGemini(geminiFileId).catch(() => {});
    };

    const stream = new ReadableStream({
      cancel: noteClientGone,
      async start(controller) {
        let processPath = videoPath;
        let useInlineData = false;
        const encoder = new TextEncoder();
        const send = (message: object) => {
          if (clientGone) return;
          try {
            controller.enqueue(encoder.encode(JSON.stringify(message) + "\n"));
          } catch {
            noteClientGone();
          }
        };
        const close = () => {
          try { controller.close(); } catch { /* already closed by the client */ }
        };
        const sendProgress = (stage: string, percent?: number) => send({ type: "progress", stage, percent });

        try {
          // Duration decides whether to transcribe in pieces; it's also sent back
          // so multi-video uploads can lay clips out on the timeline without overlap
          const videoInfo = await ffprobe(videoPath).catch(e => {
            console.warn("[Process] ffprobe failed; clip duration unknown:", e instanceof Error ? e.message : e);
            return null;
          });
          const transcribeInPieces = (videoInfo?.duration ?? 0) > LONG_MEDIA_SECONDS;

          if (transcribeInPieces) {
            // Pieces are cut straight from the upload; no whole-file audio extraction needed
          } else if (fileSizeInMB > 400) {
            sendProgress("extracting_audio", 0);
            try {
              const codec = await getAudioCodec(videoPath);
              console.log(`Detected audio codec: ${codec}`);

              let ext = "m4a";
              let newMime = "audio/mp4";

              switch (codec) {
                case "aac": ext = "m4a"; newMime = "audio/mp4"; break;
                case "mp3": ext = "mp3"; newMime = "audio/mpeg"; break;
                case "opus": ext = "ogg"; newMime = "audio/ogg"; break;
                case "vorbis": ext = "ogg"; newMime = "audio/ogg"; break;
                case "flac": ext = "flac"; newMime = "audio/flac"; break;
                default: ext = "m4a"; newMime = "audio/mp4";
              }

              const audioPath = path.join(stagingDir, `${path.basename(videoPath, path.extname(videoPath))}_audio.${ext}`);
              
              await extractAudio(videoPath, audioPath, (p) => sendProgress("extracting_audio", Math.round(p)));
              console.log('Audio extraction complete');
              
              processPath = audioPath;
              mimeType = newMime;
              
              const audioStats = fs.statSync(audioPath);
              const audioSizeInMB = audioStats.size / (1024 * 1024);
              useInlineData = audioSizeInMB < INLINE_SIZE_LIMIT_MB;
              
              console.log(`Extracted audio: ${audioSizeInMB.toFixed(2)} MB`);
            } catch (audioErr) {
              console.error('Audio extraction failed, using original file:', audioErr);
            }
          } else {
            useInlineData = fileSizeInMB < INLINE_SIZE_LIMIT_MB;
          }

          // Don't spend Gemini time on an upload the user already cancelled
          if (clientGone && isUploadCancelled(uploadId)) {
            discardCancelled("before subtitle generation", processPath);
            close();
            return;
          }

          // Generate subtitles
          let result: { subtitles: unknown; detectedLanguage?: unknown } | null = null;
          let geminiFileUri: string | null = null;
          let geminiFileExpiration: string | null = null;
          let fileId: string | null = null;
          let subtitleGenerationFailed = false;
          let subtitleWarning: string | null = null;

          const { getGlobalSettings } = await import("@/lib/global-settings-store");
          const { processWithFallback } = await import("@/lib/ai-provider");
          const settings = getGlobalSettings();

          try {
            if (transcribeInPieces) {
              const { transcribeAudio } = await import("@/lib/audio-transcription");
              const chunked = await transcribeAudio({
                sourcePath: videoPath,
                duration: videoInfo!.duration,
                workDir: stagingDir,
                secondaryLanguage,
                modelName,
                fallbackChain: settings.aiFallbackChain,
                label: originalFilename,
                onProgress: (done, total) => sendProgress("generating_subtitles", Math.round((done / total) * 100)),
              });
              result = chunked;
              if (chunked.gaps.length > 0) {
                subtitleWarning = describeGaps(chunked.gaps);
                console.warn(`[Process] ${originalFilename}: ${subtitleWarning}`);
              }
            } else if (useInlineData) {
              sendProgress("generating_subtitles");
              console.log(`Using inline data transmission (file < ${INLINE_SIZE_LIMIT_MB} MB)`);

              if (!isPathSafe(processPath)) {
                  console.warn(`[Process] Blocked unauthorized path access: ${processPath}`);
                  throw new Error('Unauthorized path');
              }
              const fileBuffer = fs.readFileSync(processPath);
              const base64Data = fileBuffer.toString('base64');

              result = await processWithFallback(
                'generate',
                {
                  base64Data,
                  mimeType,
                  secondaryLanguage: secondaryLanguage === "None" ? undefined : secondaryLanguage,
                  isInline: true,
                  modelName: modelName
                },
                settings.aiFallbackChain
              );
            } else {
              console.log(`Using Files API (file >= ${INLINE_SIZE_LIMIT_MB} MB)`);

              const geminiFile = await uploadToGemini(processPath, mimeType, (stage, percent) => {
                 sendProgress(stage, percent);
              });
              geminiFileUri = geminiFile.uri || null;
              geminiFileExpiration = geminiFile.expirationTime || null;
              fileId = geminiFile.name || null;

              sendProgress("generating_subtitles");
              result = await processWithFallback(
                'generate',
                {
                  fileUri: geminiFile.uri!,
                  mimeType,
                  secondaryLanguage: secondaryLanguage === "None" ? undefined : secondaryLanguage,
                  modelName: modelName
                },
                settings.aiFallbackChain
              );
            }
          } catch (aiError) {
            // Re-throw security/infrastructure errors; only swallow AI service failures
            const aiErrorMessage = aiError instanceof Error ? aiError.message : String(aiError);
            if (aiErrorMessage === 'Unauthorized path') throw aiError;
            console.warn(`[Process] Subtitle generation failed for ${originalFilename}, adding video with no subtitles: ${describeError(aiError)}`);
            subtitleGenerationFailed = true;
          }

          const subtitles = result?.subtitles ?? [];
          const detectedLanguage = result?.detectedLanguage ?? null;

          try {
              if (processPath !== videoPath && fs.existsSync(processPath)) {
                secureDelete(processPath).catch(e => console.error("Cleanup error", e));
              }
          } catch (e) { console.error("Cleanup error", e); }

          if (clientGone) {
            if (isUploadCancelled(uploadId)) {
              discardCancelled("after subtitle generation", processPath, fileId);
              return;
            }
            // No page is waiting to add this clip to a project; keep the work as a draft
            const { saveOrphanedUpload } = await import("@/lib/orphaned-upload");
            const draft = saveOrphanedUpload({
              videoPath,
              originalFilename,
              fileSize: fs.statSync(videoPath).size,
              subtitles: (subtitles as SubtitleLine[]) ?? [],
              detectedLanguage: typeof detectedLanguage === 'string' ? detectedLanguage : null,
              secondaryLanguage,
              duration: videoInfo?.duration,
              width: videoInfo?.width,
              height: videoInfo?.height,
              geminiFileUri,
              geminiFileExpiration,
              fileId,
            });
            console.log(`[Process] Saved ${originalFilename} as draft "${draft.name}" (${draft.id}) after the client disconnected`);
            return;
          }

          send({
            type: "complete",
            data: {
              subtitles,
              videoPath,
              detectedLanguage,
              geminiFileUri,
              geminiFileExpiration,
              fileId,
              fileSize: fs.statSync(videoPath).size,
              originalFilename,
              ...(videoInfo && { duration: videoInfo.duration, width: videoInfo.width, height: videoInfo.height }),
              ...(subtitleGenerationFailed && { subtitleGenerationFailed: true }),
              ...(subtitleWarning && { subtitleWarning })
            }
          });
          close();
        } catch (error) {
          console.error(`[Process] Processing ${originalFilename} failed: ${describeError(error)}`, error instanceof Error ? error.stack : "");
          send({ type: "error", message: error instanceof Error ? error.message : "Failed to process video" });
          
          if (videoPath && fs.existsSync(videoPath)) {
              secureDelete(videoPath).catch(err => console.error("Failed to cleanup temp video:", err));
          }
          if (processPath && processPath !== videoPath && fs.existsSync(processPath)) {
              secureDelete(processPath).catch(err => console.error("Failed to cleanup extracted audio:", err));
          }
          close();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error(`[Process] Could not start processing ${originalFilename}: ${describeError(error)}`);
    secureDelete(videoPath).catch(e => console.error("Failed to cleanup upload:", e));
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to process video" }, { status: 500 });
  }
}