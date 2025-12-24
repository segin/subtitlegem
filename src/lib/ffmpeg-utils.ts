import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";

export async function getAudioCodec(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const audioStream = metadata.streams.find((s) => s.codec_type === "audio");
      if (!audioStream || !audioStream.codec_name) {
        return reject(new Error("No audio stream found"));
      }
      resolve(audioStream.codec_name);
    });
  });
}

export async function extractAudio(videoPath: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("copy") // Copy audio track without re-encoding as requested
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

export async function burnSubtitles(videoPath: string, srtPath: string, outputPath: string, config: any): Promise<string> {
  // This will be used for the final export
  // config can contain style options for ffmpeg's subtitles filter
  return new Promise((resolve, reject) => {
    // Basic implementation, can be expanded with style options
    ffmpeg(videoPath)
      .videoFilter(`subtitles=${srtPath}`)
      .on("end", () => resolve(outputPath))
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}
