import { NextRequest, NextResponse } from "next/server";
import { uploadToGemini, generateSubtitles } from "@/lib/gemini";
import { extractAudio, getAudioCodec } from "@/lib/ffmpeg-utils";
import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import busboy from "busboy";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export const runtime = 'nodejs';

// Add "None" or empty string to allowed
const ALLOWED_LANGUAGES = ["Simplified Chinese", "Spanish", "French", "Japanese", "German"];

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
          case "flac":
            ext = "flac";
            newMime = "audio/flac";
            break;
          case "pcm_s16le":
          case "pcm_s24le":
            ext = "wav";
            newMime = "audio/wav";
            break;
          default:
            console.warn(`Unknown/unmapped codec ${codec}, defaulting to m4a/mp4 container.`);
            ext = "m4a";
            newMime = "audio/mp4";
        }

        const audioPath = path.join(tempDir, `${uuidv4()}.${ext}`); 
        await extractAudio(videoPath, audioPath);
        processPath = audioPath;
        mimeType = newMime;
      } catch (err) {
        console.error("Failed to detect audio codec, falling back to m4a", err);
        // Fallback
        const audioPath = path.join(tempDir, `${uuidv4()}.m4a`); 
        await extractAudio(videoPath, audioPath);
        processPath = audioPath;
        mimeType = "audio/mp4"; 
      }
    }

    const geminiFile = await uploadToGemini(processPath, mimeType);
    const subtitles = await generateSubtitles(geminiFile.uri, mimeType, secondaryLanguage === "None" ? undefined : secondaryLanguage);

    // Clean up
    try {
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        if (processPath !== videoPath && fs.existsSync(processPath)) fs.unlinkSync(processPath);
    } catch (e) { console.error("Cleanup error", e); }

    return NextResponse.json({ subtitles });

  } catch (error: any) {
    console.error("Error processing video:", error);
    return NextResponse.json({ error: error.message || "Failed to process video" }, { status: 500 });
  }
}