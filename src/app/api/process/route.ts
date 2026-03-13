import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uploadToGemini, generateSubtitles, generateSubtitlesInline, translateSubtitles } from "@/lib/gemini";
import { extractAudio, getAudioCodec, createSampleClip } from "@/lib/ffmpeg-utils"; // Added createSampleClip
import fs from "fs";
import path from "path";
import { getStorageConfig, isPathSafe } from "@/lib/storage-config";
import { v4 as uuidv4 } from "uuid";
import busboy from "busboy";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { secureDelete } from "@/lib/security";
import { validateAuth } from "@/lib/auth";
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

      const TranslateSchema = z.object({
        mode: z.literal('translate'),
        subtitles: z.array(z.any()), // Basic check, could be stricter
        secondaryLanguage: z.string(),
        model: z.string().optional(),
        clipId: z.string().optional(),
      });

      const Schema = z.discriminatedUnion('mode', [ReprocessSchema, TranslateSchema]);
      
      const validation = Schema.safeParse(body);
      
      if (!validation.success) {
         return NextResponse.json({ error: "Invalid request data", details: validation.error.format() }, { status: 400 });
      }

      const { mode, fileUri, filePath, language, secondaryLanguage, subtitles, model, clipId, sampleDuration, promptHints } = validation.data as any;
      const modelName = model || "gemini-2.5-flash";

      if (mode === 'reprocess') {
         // We need either a Gemini URI or a local File Path
         if (!fileUri && !filePath) {
             return NextResponse.json({ error: "No fileUri or filePath provided" }, { status: 400 });
         }

         const { getGlobalSettings } = await import("@/lib/global-settings-store");
         const { processWithFallback } = await import("@/lib/ai-provider");
         const { uploadToGemini } = await import("@/lib/gemini");
         const settings = getGlobalSettings();
         const config = getStorageConfig();

         // Security check: strict path validation for local files
         if (filePath) {
             if (!isPathSafe(filePath)) {
                 console.warn(`[Process] Blocked unauthorized path access: ${filePath}`);
                 return NextResponse.json({ error: 'Unauthorized path' }, { status: 403 });
             }
         }
         
         let targetUri = fileUri;
         let targetMime = "video/mp4"; // Default assumption, or derive from path
         let newGeminiFile = null;

         // If we have a local path but no URI (or we want to re-upload), handle that
         if (!targetUri && filePath) {
             console.log(`Reprocessing from local file: ${filePath}`);
             
             const resolvedPath = path.resolve(filePath);
             if (!fs.existsSync(resolvedPath)) {
                 return NextResponse.json({ error: "Local file not found" }, { status: 404 });
             }
             
             // Check size/type - simplify for now assuming video/mp4 or audio
             // In a real scenario we'd check mime type properly
             const ext = path.extname(filePath).toLowerCase();
             if (['.mp3', '.wav', '.m4a', '.flac', '.ogg'].includes(ext)) {
                 targetMime = "audio/" + ext.replace('.', '');
                 if (ext === '.m4a') targetMime = "audio/mp4";
             }

             // Check if we can do inline
             const stats = fs.statSync(filePath);
             const fileSizeInMB = stats.size / (1024 * 1024);
             let processPath = filePath;
             let useInlineData = false;
             const INLINE_SIZE_LIMIT_MB = 95;
             
             if (fileSizeInMB > 400 && !sampleDuration) {
                 console.log("File > 400MB, extracting audio for reprocess...");
                 try {
                     const codec = await getAudioCodec(filePath);
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

                     const stagingDir = config.stagingDir;
                     const tempDir = path.join(stagingDir, 'temp');
                     if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                     const audioPath = path.join(tempDir, `${path.basename(filePath, path.extname(filePath))}_audio_${Date.now()}.${ext}`);
                     
                     await extractAudio(filePath, audioPath);
                     console.log('Audio extraction complete');
                     
                     processPath = audioPath;
                     targetMime = newMime;
                     
                     const audioStats = fs.statSync(audioPath);
                     const audioSizeInMB = audioStats.size / (1024 * 1024);
                     useInlineData = audioSizeInMB < INLINE_SIZE_LIMIT_MB;
                     
                 } catch (audioErr) {
                     console.error('Audio extraction failed, using original file:', audioErr);
                     useInlineData = fileSizeInMB < INLINE_SIZE_LIMIT_MB;
                 }
             } else {
                 useInlineData = fileSizeInMB < INLINE_SIZE_LIMIT_MB;
             }
             
             if (useInlineData && !sampleDuration) {
                  // Inline
                  if (!isPathSafe(processPath)) {
                      console.warn(`[Process] Blocked unauthorized path access: ${processPath}`);
                      return NextResponse.json({ error: 'Unauthorized path' }, { status: 403 });
                  }
                  const fileBuffer = fs.readFileSync(processPath);
                  const base64Data = fileBuffer.toString('base64');
                  console.log(`Reprocessing inline`);
                  
                  const result = await processWithFallback(
                    'generate',
                    { 
                        base64Data, 
                        mimeType: targetMime, 
                        secondaryLanguage: secondaryLanguage === "None" ? undefined : secondaryLanguage,
                        isInline: true,
                        promptHints
                    },
                    settings.aiFallbackChain
                  );
                  
                  if (processPath !== filePath && fs.existsSync(processPath)) {
                      fs.unlinkSync(processPath); // cleanup extracted audio
                  }
                  
                  return NextResponse.json({ ...result, clipId });
             } else {
                 // Upload to Gemini
                 // NOTE: We only upload here if NOT doing sampleDuration. 
                 // If doing usage sampleDuration, we handle it below.
                 if (!sampleDuration) {
                    console.log(`Uploading local file to Gemini...`);
                    newGeminiFile = await uploadToGemini(processPath, targetMime);
                    targetUri = newGeminiFile.uri;
                    
                    if (processPath !== filePath && fs.existsSync(processPath)) {
                        fs.unlinkSync(processPath); // cleanup extracted audio
                    }
                 }
             }
         }

         // Handle Sample Mode
         let processUri = targetUri;
         let cleanupPath: string | null = null;
         let uploadedSampleFile: any = null;

         if (sampleDuration && filePath) {
             console.log(`Creating ${sampleDuration}s sample from ${filePath}`);
             
             const tempDir = path.join(config.stagingDir, 'temp');
             if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
             
             const ext = path.extname(filePath) || ".mp4";
             const samplePath = path.join(tempDir, `sample_${uuidv4()}${ext}`);
             
             try {
                 await createSampleClip(filePath, samplePath, sampleDuration);
                 console.log(`Sample created: ${samplePath}`);
                 
                 // Upload Sample to Gemini
                 uploadedSampleFile = await uploadToGemini(samplePath, targetMime);
                 processUri = uploadedSampleFile.uri;
                 cleanupPath = samplePath; // Mark for cleanup
             } catch (sampleErr) {
                 console.error("Sample creation failed:", sampleErr);
                 // Cleanup if partially created
                 if (fs.existsSync(samplePath)) fs.unlinkSync(samplePath);
                 throw new Error("Failed to create sample clip");
             }
         }

         console.log(`Reprocessing with URI: ${processUri}, Lang: ${language}`);
         const result = await processWithFallback(
           'generate',
           { 
               fileUri: processUri, 
               mimeType: targetMime, 
               secondaryLanguage: secondaryLanguage === "None" ? undefined : secondaryLanguage,
               promptHints: promptHints
           },
           settings.aiFallbackChain
         );
         
         if (cleanupPath && fs.existsSync(cleanupPath)) {
            try { fs.unlinkSync(cleanupPath); } catch (e) { /* ignore */ }
         }
         
         return NextResponse.json({ 
             ...result, 
             clipId,
             // Pass back new gemini info if we uploaded
             geminiFileUri: newGeminiFile?.uri || fileUri,
             geminiFileExpiration: newGeminiFile?.expirationTime || undefined,
             fileId: newGeminiFile?.name || undefined
         });
      
      } else if (mode === 'translate') {
         if (!subtitles) return NextResponse.json({ error: "No subtitles provided" }, { status: 400 });
         
         const { getGlobalSettings } = await import("@/lib/global-settings-store");
         const { processWithFallback } = await import("@/lib/ai-provider");
         const settings = getGlobalSettings();
         
         console.log(`Retranslating to: ${secondaryLanguage} using fallback chain`);
         const result = await processWithFallback(
           'translate',
           { subtitles, targetLanguage: secondaryLanguage },
           settings.aiFallbackChain
         );
         
         return NextResponse.json({ subtitles: result.subtitles, clipId });
      }
      
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });

    } catch (e: any) {
      console.error("API Error:", e);
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // Handle Multipart Upload (Existing Logic + Meta Return)
  console.log("Processing POST request to /api/process (Streamed via Busboy)");

  let videoPath = ""; // Hoisted for error cleanup

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
    let modelName = "gemini-2.5-flash";
    let originalFilename = "";
    
    // We need to wait for BOTH busboy to finish parsing AND the file write stream to finish writing.
    const fileWritePromise = new Promise<void>((resolve, reject) => {
       const bb = busboy({ headers: { "content-type": contentType } });

       bb.on("file", (name, file, info) => {
        if (name === "video") {
          const { filename, mimeType: fileMime } = info;
          mimeType = fileMime;
          originalFilename = filename;
          
          const ext = filename.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || "tmp";
          videoPath = path.join(tempDir, `${uuidv4()}.${ext}`);
          console.log(`Streaming file to ${videoPath}`);

          const writeStream = fs.createWriteStream(videoPath);
          file.pipe(writeStream);

          writeStream.on("error", reject);
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
      });
      
      // If busboy finishes but we never got a file, we might hang if we rely only on writeStream.finish
      // ensuring we handle errors properly.
      bb.on("error", reject);
      
      // @ts-ignore
      const nodeStream = Readable.fromWeb(req.body);
      nodeStream.pipe(bb);
    });
    
    await fileWritePromise;

    if (!videoPath) {
        return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }
    
    // Safety Check: Verify file exists and has size > 0
    if (!fs.existsSync(videoPath) || fs.statSync(videoPath).size === 0) {
         console.error(`File upload failed: ${videoPath} is empty or missing.`);
         return NextResponse.json({ error: "File upload failed (empty file)" }, { status: 400 });
    }
    
    if (secondaryLanguage && secondaryLanguage !== "None" && !ALLOWED_LANGUAGES.includes(secondaryLanguage)) {
        if (secondaryLanguage.trim() !== "") {
             return NextResponse.json({ error: "Invalid secondary language" }, { status: 400 });
        }
    }

    const stats = fs.statSync(videoPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    console.log(`File uploaded: ${videoPath}, Size: ${fileSizeInMB.toFixed(2)}MB`);

    const stagingDir = tempDir; 
    const INLINE_SIZE_LIMIT_MB = 95; // New limit: 100MB base64, use 95MB raw for safety margin

    // Use streaming response for progress feedback
    const stream = new ReadableStream({
      async start(controller) {
        let processPath = videoPath;
        let useInlineData = false;
        const encoder = new TextEncoder();
        const sendProgress = (stage: string, percent?: number) => {
          controller.enqueue(encoder.encode(JSON.stringify({ type: "progress", stage, percent }) + "\n"));
        };

        try {
          if (fileSizeInMB > 400) {
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

          // Generate subtitles
          let result;
          let geminiFileUri: string | null = null;
          let geminiFileExpiration: string | null = null;
          let fileId: string | null = null;
          
          const { getGlobalSettings } = await import("@/lib/global-settings-store");
          const { processWithFallback } = await import("@/lib/ai-provider");
          const settings = getGlobalSettings();
          const targetModel = modelName || "gemini-2.0-flash"; // Favoring 2.0/3.1 flash per user hint

          if (useInlineData) {
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
                modelName: modelName // Pass requested model
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
                modelName: modelName // Pass requested model
              },
              settings.aiFallbackChain
            );
          }
          
          const { subtitles, detectedLanguage } = result;

          try {
              if (processPath !== videoPath && fs.existsSync(processPath)) {
                secureDelete(processPath).catch(e => console.error("Cleanup error", e)); 
              }
          } catch (e) { console.error("Cleanup error", e); }

          controller.enqueue(encoder.encode(JSON.stringify({ 
            type: "complete",
            data: {
              subtitles, 
              videoPath, 
              detectedLanguage,
              geminiFileUri,
              geminiFileExpiration,
              fileId,
              fileSize: fs.statSync(videoPath).size,
              originalFilename
            }
          }) + "\n"));
          controller.close();
        } catch (error: any) {
          console.error("Error processing video:", error);
          controller.enqueue(encoder.encode(JSON.stringify({ type: "error", message: error.message || "Failed to process video" }) + "\n"));
          
          if (videoPath && fs.existsSync(videoPath)) {
              secureDelete(videoPath).catch(err => console.error("Failed to cleanup temp video:", err));
          }
          controller.close();
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

  } catch (error: any) {
    console.error("Fatal Error processing video:", error);
    return NextResponse.json({ error: error.message || "Failed to process video" }, { status: 500 });
  }
}