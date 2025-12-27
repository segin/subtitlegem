import { NextRequest, NextResponse } from "next/server";
import { uploadToGemini, generateSubtitles, generateSubtitlesInline } from "@/lib/gemini";
import { extractAudio, getAudioCodec } from "@/lib/ffmpeg-utils";
import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import busboy from "busboy";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import ffmpeg from "fluent-ffmpeg";

export const runtime = 'nodejs';

// Add "None" or empty string to allowed
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
  "Arabic"
];

export async function POST(req: NextRequest) {
  console.log("Processing POST request to /api/process (Streamed via Busboy)");

  try {
    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Content-Type must be multipart/form-data" }, { status: 400 });
    }

    const tempDir = os.tmpdir();
    let videoPath = "";
    let mimeType = "";
    let secondaryLanguage = "Simplified Chinese";
    let modelName = "gemini-2.5-flash";
    
    // Create a promise to handle the busboy parsing
    await new Promise<void>((resolve, reject) => {
      const bb = busboy({ headers: { "content-type": contentType } });

      bb.on("file", (name, file, info) => {
        if (name === "video") {
          const { filename, mimeType: fileMime } = info;
          mimeType = fileMime;
          
          const ext = filename.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || "tmp";
          videoPath = path.join(tempDir, `${uuidv4()}.${ext}`);
          console.log(`Streaming file to ${videoPath}`);

          const writeStream = fs.createWriteStream(videoPath);
          file.pipe(writeStream);

          writeStream.on("error", reject);
        } else {
          file.resume(); // Skip other files
        }
      });

      bb.on("field", (name, val) => {
        if (name === "secondaryLanguage") {
          secondaryLanguage = val;
        }
        if (name === "model") {
          modelName = val;
        }
      });

      bb.on("close", resolve);
      bb.on("error", reject);

      // Convert Web Stream to Node Stream and pipe to busboy
      // @ts-ignore
      const nodeStream = Readable.fromWeb(req.body);
      nodeStream.pipe(bb);
    });

    if (!videoPath) {
        return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }
    
    // Validate Secondary Language (if present and not "None")
    if (secondaryLanguage && secondaryLanguage !== "None" && !ALLOWED_LANGUAGES.includes(secondaryLanguage)) {
        // If it's empty, we treat it as no secondary language
        if (secondaryLanguage.trim() !== "") {
             return NextResponse.json({ error: "Invalid secondary language" }, { status: 400 });
        }
    }

    // Check file size on disk
    const stats = fs.statSync(videoPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    console.log(`File uploaded: ${videoPath}, Size: ${fileSizeInMB.toFixed(2)}MB`);

    let processPath = videoPath;
    const stagingDir = tempDir; // Use tempDir as staging directory
    let useInlineData = false;

    if (fileSizeInMB > 400) {
      console.log("File > 400MB, extracting audio...");
      try {
        const codec = await getAudioCodec(videoPath);
        console.log(`Detected audio codec: ${codec}`);

        let ext = "m4a";
        let newMime = "audio/mp4";

        switch (codec) {
          case "aac":
            ext = "m4a";
            newMime = "audio/mp4";
            break;
          case "mp3":
            ext = "mp3";
            newMime = "audio/mpeg";
            break;
          case "opus":
            ext = "ogg";
            newMime = "audio/ogg";
            break;
          case "vorbis":
            ext = "ogg";
            newMime = "audio/ogg";
            break;
    let useInlineData = false;
    const INLINE_SIZE_LIMIT_MB = 9.8; // Guard band below 10MB limit
    const LARGE_FILE_THRESHOLD_MB = 400; // Extract audio for very large files

    // For large files (>400MB), extract audio for Gemini
    if (fileSizeInMB > LARGE_FILE_THRESHOLD_MB) {
      console.log(`Large file detected (${fileSizeInMB.toFixed(2)} MB) - extracting audio`);
      const audioPath = path.join(stagingDir, `${path.basename(videoPath, path.extname(videoPath))}_audio.m4a`);
      
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .noVideo()
          .audioCodec('copy') // Stream copy - no re-encoding!
          .outputOptions('-movflags', 'faststart') // Optimize for streaming
          .on('end', () => {
            console.log('Audio extraction complete (stream copy - no re-encoding)');
            resolve();
          })
          .on('error', (err: any) => {
            console.error('Audio extraction failed:', err);
            reject(err);
          })
          .save(audioPath);
      });
      
      processPath = audioPath;
      
      // Check if extracted audio is small enough for inline
      const audioStats = fs.statSync(audioPath);
      const audioSizeInMB = audioStats.size / (1024 * 1024);
      useInlineData = audioSizeInMB < INLINE_SIZE_LIMIT_MB;
      
      console.log(`Extracted audio: ${audioSizeInMB.toFixed(2)} MB`);
    } else {
      // Small/medium video - check if we can send inline
      useInlineData = fileSizeInMB < INLINE_SIZE_LIMIT_MB;
    }

    // Generate subtitles using appropriate method
    let subtitles;
    
    if (useInlineData) {
      console.log(`Using inline data transmission (file < ${INLINE_SIZE_LIMIT_MB} MB)`);
      
      // Read file and encode as base64
      const fileBuffer = fs.readFileSync(processPath);
      const base64Data = fileBuffer.toString('base64');
      
      // Send inline to Gemini
      subtitles = await generateSubtitlesInline(
        base64Data,
        mimeType,
        secondaryLanguage === "None" ? undefined : secondaryLanguage,
        1,
        modelName
      );
    } else {
      console.log(`Using Files API (file >= ${INLINE_SIZE_LIMIT_MB} MB)`);
      
      // Upload to Gemini Files API
      const geminiFile = await uploadToGemini(processPath, mimeType);
      subtitles = await generateSubtitles(
        geminiFile.uri,
        mimeType,
        secondaryLanguage === "None" ? undefined : secondaryLanguage,
        1,
        modelName
      );
    }

    // Clean up - KEEP the original video, only delete extracted audio
    try {
        // Only delete the audio extract if we created one
        if (processPath !== videoPath && fs.existsSync(processPath)) {
          fs.unlinkSync(processPath);
          console.log(`Cleaned up audio extract: ${processPath}`);
        }
        // DO NOT delete videoPath - it's needed for preview and export
    } catch (e) { console.error("Cleanup error", e); }

    // Return the path of the ORIGINAL video for preview/export
    return NextResponse.json({ subtitles, videoPath });

  } catch (error: any) {
    console.error("Error processing video:", error);
    return NextResponse.json({ error: error.message || "Failed to process video" }, { status: 500 });
  }
}