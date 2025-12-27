import { NextRequest, NextResponse } from "next/server";
import { burnSubtitles } from "@/lib/ffmpeg-utils";
import { generateAss } from "@/lib/ass-utils";
import { createJob, updateJob } from "@/lib/job-store";
import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";

// This API starts a long-running job and returns immediately.
export async function POST(req: NextRequest) {
  try {
    const { 
        videoPath, // We need a way to get the original video path
        subtitles, 
        config, 
        exportOptions 
    } = await req.json();

    if (!videoPath || !fs.existsSync(videoPath)) {
        return NextResponse.json({ error: "Original video file not found or path not provided. This feature requires stateful file management." }, { status: 400 });
    }

    const jobId = uuidv4();
    createJob(jobId);

    // Run the long-running ffmpeg process in the background
    (async () => {
        try {
            updateJob(jobId, { status: 'processing', message: 'Generating styled subtitle file...' });
            
            const tempDir = os.tmpdir();
            const assPath = path.join(tempDir, `${jobId}.ass`);
            
            // Generate ASS content with styles
            const assContent = generateAss(subtitles, config);
            fs.writeFileSync(assPath, assContent);
            
            const outputPath = path.join(tempDir, `${jobId}_output.mp4`);

            await burnSubtitles(videoPath, assPath, outputPath, {
                ...exportOptions,
                onProgress: (percent) => {
                    updateJob(jobId, { 
                        progress: parseFloat(percent.toFixed(2)),
                        message: `Encoding video... ${percent.toFixed(2)}%`
                    });
                }
            });

            updateJob(jobId, { 
                status: 'completed', 
                progress: 100, 
                message: 'Your video is ready!',
                resultPath: outputPath 
            });

            // Clean up ASS file
            fs.unlinkSync(assPath);

        } catch (error: any) {
            console.error(`Job ${jobId} failed:`, error);
            updateJob(jobId, { status: 'failed', message: error.message || "An unknown error occurred" });
        }
    })();

    return NextResponse.json({ jobId });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}