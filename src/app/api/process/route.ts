import { NextRequest, NextResponse } from "next/server";
import { uploadToGemini, generateSubtitles } from "@/lib/gemini";
import { extractAudio } from "@/lib/ffmpeg-utils";
import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const videoFile = formData.get("video") as File;
    const secondaryLanguage = formData.get("secondaryLanguage") as string || "Simplified Chinese";

    if (!videoFile) {
      return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }

    const tempDir = os.tmpdir();
    const videoPath = path.join(tempDir, `${uuidv4()}-${videoFile.name}`);
    const buffer = Buffer.from(await videoFile.arrayBuffer());
    fs.writeFileSync(videoPath, buffer);

    const fileSizeInMB = videoFile.size / (1024 * 1024);
    let processPath = videoPath;
    let mimeType = videoFile.type;

    if (fileSizeInMB > 400) {
      const audioPath = path.join(tempDir, `${uuidv4()}.m4a`); // assuming m4a or similar
      await extractAudio(videoPath, audioPath);
      processPath = audioPath;
      mimeType = "audio/mpeg"; // Simplified, should detect actual mime
    }

    const geminiFile = await uploadToGemini(processPath, mimeType);
    const subtitles = await generateSubtitles(geminiFile.uri, mimeType, secondaryLanguage);

    // Clean up temp files
    fs.unlinkSync(videoPath);
    if (processPath !== videoPath) {
      fs.unlinkSync(processPath);
    }

    return NextResponse.json({ subtitles });
  } catch (error: any) {
    console.error("Error processing video:", error);
    return NextResponse.json({ error: error.message || "Failed to process video" }, { status: 500 });
  }
}
