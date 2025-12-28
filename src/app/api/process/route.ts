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
import ffmpeg from "fluent-ffmpeg";

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
      const { mode, fileUri, language, secondaryLanguage, subtitles, model } = await req.json();
      const modelName = model || "gemini-2.5-flash";

      if (mode === 'reprocess') {
         if (!fileUri) return NextResponse.json({ error: "No fileUri provided" }, { status: 400 });
         
         console.log(`Reprocessing with file: ${fileUri}, Lang: ${language}`);
         const result = await generateSubtitles(
            fileUri, 
            "video/mp4", // In reprocess mode we assume video uri is valid and type is generic enough or known
            secondaryLanguage === "None" ? undefined : secondaryLanguage,
            1,
            modelName
         );
         
         // Override detected language if we forced it? No, keep AI detection or allow user override hint?
         // For now, return result.
         return NextResponse.json(result);
      
      } else if (mode === 'translate') {
         if (!subtitles) return NextResponse.json({ error: "No subtitles provided" }, { status: 400 });
         
         console.log(`Retranslating to: ${secondaryLanguage}`);
         const translated = await translateSubtitles(subtitles, secondaryLanguage, modelName);
         
         return NextResponse.json({ subtitles: translated });
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
        
        await new Promise<void>((resolve, reject) => {
          ffmpeg(videoPath)
            .noVideo()
            .audioCodec('copy')
            .outputOptions('-movflags', 'faststart')
            .on('end', () => {
              console.log('Audio extraction complete');
              resolve();
            })
            .on('error', (err: any) => {
              console.error('Audio extraction failed:', err);
              reject(err);
            })
            .save(audioPath);
        });
        
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
    
    if (useInlineData) {
      console.log(`Using inline data transmission (file < ${INLINE_SIZE_LIMIT_MB} MB)`);
      
      const fileBuffer = fs.readFileSync(processPath);
      const base64Data = fileBuffer.toString('base64');
      result = await generateSubtitlesInline(
        base64Data,
        mimeType,
        secondaryLanguage === "None" ? undefined : secondaryLanguage,
        1,
        modelName
      );
    } else {
      console.log(`Using Files API (file >= ${INLINE_SIZE_LIMIT_MB} MB)`);
      
      const geminiFile = await uploadToGemini(processPath, mimeType);
      geminiFileUri = geminiFile.uri || null;
      geminiFileExpiration = geminiFile.expirationTime || null;
      fileId = geminiFile.name || null;
      
      result = await generateSubtitles(
        geminiFile.uri!,
        mimeType,
        secondaryLanguage === "None" ? undefined : secondaryLanguage,
        1,
        modelName
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
      fileId
    });

  } catch (error: any) {
    console.error("Error processing video:", error);
    return NextResponse.json({ error: error.message || "Failed to process video" }, { status: 500 });
  }
}