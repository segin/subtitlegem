import { NextRequest, NextResponse } from "next/server";
import { uploadToGemini, generateSubtitles, generateSubtitlesInline, translateSubtitles } from "@/lib/gemini";
import { extractAudio, getAudioCodec } from "@/lib/ffmpeg-utils";
import fs from "fs";
import path from "path";
import { getStorageConfig } from "@/lib/storage-config";
import { v4 as uuidv4 } from "uuid";
import busboy from "busboy";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
// fluent-ffmpeg removed - using native child_process in ffmpeg-utils

export const runtime = 'nodejs';

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
  // Handle JSON requests for Reprocessing/Translation
  if (req.headers.get("content-type")?.includes("application/json")) {
    try {
      const { mode, fileUri, filePath, language, secondaryLanguage, subtitles, model, clipId } = await req.json();
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
         
         let targetUri = fileUri;
         let targetMime = "video/mp4"; // Default assumption, or derive from path
         let newGeminiFile = null;

         // If we have a local path but no URI (or we want to re-upload), handle that
         if (!targetUri && filePath) {
             console.log(`Reprocessing from local file: ${filePath}`);
             if (!fs.existsSync(filePath)) {
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
             const sizeMB = stats.size / (1024 * 1024);
             
             if (sizeMB < 9.8) {
                 // Inline
                 const fileBuffer = fs.readFileSync(filePath);
                 const base64Data = fileBuffer.toString('base64');
                 console.log(`Reprocessing inline (${sizeMB.toFixed(2)} MB)`);
                 
                 const result = await processWithFallback(
                   'generate',
                   { 
                       base64Data, 
                       mimeType: targetMime, 
                       secondaryLanguage: secondaryLanguage === "None" ? undefined : secondaryLanguage,
                       isInline: true
                   },
                   settings.aiFallbackChain
                 );
                 return NextResponse.json({ ...result, clipId });
             } else {
                 // Upload to Gemini
                 console.log(`Uploading local file to Gemini (${sizeMB.toFixed(2)} MB)...`);
                 newGeminiFile = await uploadToGemini(filePath, targetMime);
                 targetUri = newGeminiFile.uri;
             }
         }

         console.log(`Reprocessing with URI: ${targetUri}, Lang: ${language}`);
         const result = await processWithFallback(
           'generate',
           { 
               fileUri: targetUri, 
               mimeType: targetMime, 
               secondaryLanguage: secondaryLanguage === "None" ? undefined : secondaryLanguage 
           },
           settings.aiFallbackChain
         );
         
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

  try {
    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Content-Type must be multipart/form-data" }, { status: 400 });
    }

    const config = getStorageConfig();
    const tempDir = path.join(config.stagingDir, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    let videoPath = "";
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
    
    // Extract original filename from path if possible, or just use what we have
    // Actually busboy gave us 'filename' but we lost it in the scope. 
    // Let's modify the scope to capture it.
    // ... wait, I need to capture it in the promise.
    
    // RE-EDITING previous block to capture filename. 
    // Since I can't easily reach back into the promise scope without a larger edit, 
    // I will parse the 'displayName' if available or just use a fallback in the UI for now 
    // OR better: I will fix the scope in the next step.
    
    // actually let's look at the busboy block again.
    
    if (secondaryLanguage && secondaryLanguage !== "None" && !ALLOWED_LANGUAGES.includes(secondaryLanguage)) {
        if (secondaryLanguage.trim() !== "") {
             return NextResponse.json({ error: "Invalid secondary language" }, { status: 400 });
        }
    }

    const stats = fs.statSync(videoPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    console.log(`File uploaded: ${videoPath}, Size: ${fileSizeInMB.toFixed(2)}MB`);

    let processPath = videoPath;
    const stagingDir = tempDir; 
    let useInlineData = false;
    const INLINE_SIZE_LIMIT_MB = 9.8; 

    if (fileSizeInMB > 400) {
      console.log("File > 400MB, extracting audio...");
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
        
        await extractAudio(videoPath, audioPath);
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

    if (useInlineData) {
      console.log(`Using inline data transmission (file < ${INLINE_SIZE_LIMIT_MB} MB)`);
      
      const fileBuffer = fs.readFileSync(processPath);
      const base64Data = fileBuffer.toString('base64');
      
      // Note: currently processWithFallback needs to handle inline vs Files API
      // I'll update it to pass through more info or just use a specific task
      result = await processWithFallback(
        'generate',
        { base64Data, mimeType, secondaryLanguage: secondaryLanguage === "None" ? undefined : secondaryLanguage, isInline: true },
        settings.aiFallbackChain
      );
    } else {
      console.log(`Using Files API (file >= ${INLINE_SIZE_LIMIT_MB} MB)`);
      
      const geminiFile = await uploadToGemini(processPath, mimeType);
      geminiFileUri = geminiFile.uri || null;
      geminiFileExpiration = geminiFile.expirationTime || null;
      fileId = geminiFile.name || null;
      
      result = await processWithFallback(
        'generate',
        { fileUri: geminiFile.uri!, mimeType, secondaryLanguage: secondaryLanguage === "None" ? undefined : secondaryLanguage },
        settings.aiFallbackChain
      );
    }
    
    const { subtitles, detectedLanguage } = result;

    try {
        if (processPath !== videoPath && fs.existsSync(processPath)) {
          fs.unlinkSync(processPath);
          console.log(`Cleaned up audio extract: ${processPath}`);
        }
    } catch (e) { console.error("Cleanup error", e); }

    return NextResponse.json({ 
      subtitles, 
      videoPath, 
      detectedLanguage,
      geminiFileUri,
      geminiFileExpiration,
      fileId,
      fileSize: fs.statSync(videoPath).size,
      originalFilename
    });

  } catch (error: any) {
    console.error("Error processing video:", error);
    return NextResponse.json({ error: error.message || "Failed to process video" }, { status: 500 });
  }
}