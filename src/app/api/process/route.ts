import { NextRequest, NextResponse } from "next/server";
import { uploadToGemini, generateSubtitles } from "@/lib/gemini";
import { extractAudio } from "@/lib/ffmpeg-utils";
import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

export const runtime = 'nodejs';

const ALLOWED_LANGUAGES = ["Simplified Chinese", "Spanish", "French", "Japanese", "German"];

export async function POST(req: NextRequest) {
  console.log("Processing POST request to /api/process");
  
  try {
    const formData = await req.formData();
    const videoFile = formData.get("video") as File;
    const secondaryLanguage = formData.get("secondaryLanguage") as string || "Simplified Chinese";

    if (!videoFile) {
      return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }

    if (!ALLOWED_LANGUAGES.includes(secondaryLanguage)) {
       return NextResponse.json({ error: "Invalid secondary language" }, { status: 400 });
    }

    console.log(`Received file: ${videoFile.name}, size: ${videoFile.size}, type: ${videoFile.type}`);

    const tempDir = os.tmpdir();
    // Sanitize filename: use UUID + strictly mapped extension or default
    const ext = videoFile.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || "tmp";
    const videoPath = path.join(tempDir, `${uuidv4()}.${ext}`);
    
    // Stream file to disk to avoid memory exhaustion
    // Convert Web Stream to Node Stream
    // @ts-ignore - Readable.fromWeb is available in Node 18+ but Typescript might complain depending on lib
    const fileStream = Readable.fromWeb(videoFile.stream());
    await pipeline(fileStream, fs.createWriteStream(videoPath));
    
    console.log(`File written to ${videoPath}`);

    const fileSizeInMB = videoFile.size / (1024 * 1024);
    let processPath = videoPath;
    let mimeType = videoFile.type;

    if (fileSizeInMB > 400) {
      const audioPath = path.join(tempDir, `${uuidv4()}.m4a`); 
      await extractAudio(videoPath, audioPath);
      processPath = audioPath;
      mimeType = "audio/mp4"; 
    }

    const geminiFile = await uploadToGemini(processPath, mimeType);
    const subtitles = await generateSubtitles(geminiFile.uri, mimeType, secondaryLanguage);

    // Clean up temp files
    try {
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        if (processPath !== videoPath && fs.existsSync(processPath)) fs.unlinkSync(processPath);
    } catch (cleanupError) {
        console.error("Error cleaning up files:", cleanupError);
    }

    return NextResponse.json({ subtitles });
  } catch (error: any) {
    console.error("Error processing video:", error);
    return NextResponse.json({ error: error.message || "Failed to process video" }, { status: 500 });
  }
}
