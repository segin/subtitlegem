import { NextRequest, NextResponse } from "next/server";
import { queueManager } from "@/lib/queue-manager";
import { burnSubtitles } from "@/lib/ffmpeg-utils";
import { generateAss } from "@/lib/ass-utils";
import { SubtitleLine, SubtitleConfig, FFmpegConfig } from "@/types/subtitle";
import * as fs from "fs";
import * as path from "path";
import { getStagingDir } from "@/lib/storage-config";
import { v4 as uuidv4 } from "uuid";

export const runtime = 'nodejs';

interface ExportRequest {
  videoPath: string;
  subtitles: SubtitleLine[];
  config: SubtitleConfig;
  sampleDuration?: number | null;
}

// Metadata store for export jobs (extends queue items with export-specific data)
const exportMetadata = new Map<string, {
  assPath: string;
  outputPath: string;
  videoPath: string;
  sampleDuration?: number;
  ffmpegConfig: FFmpegConfig;
}>();

export async function POST(req: NextRequest) {
  try {
    const { videoPath, subtitles, config, sampleDuration }: ExportRequest = await req.json();
    const stagingDir = getStagingDir();

    if (!videoPath) {
      return NextResponse.json({ error: "Missing video path" }, { status: 400 });
    }

    if (!fs.existsSync(videoPath)) {
      return NextResponse.json({ error: "Video file not found" }, { status: 404 });
    }

    // Generate unique ID for this export job
    const jobId = uuidv4();
    const exportDir = path.join(stagingDir, "exports", jobId);
    
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const assPath = path.join(exportDir, "subtitles.ass");
    const outputName = `export_${path.basename(videoPath, path.extname(videoPath))}_${Date.now()}.mp4`;
    const outputPath = path.join(exportDir, outputName);

    // Generate ASS file
    const assContent = generateAss(subtitles, config);
    fs.writeFileSync(assPath, assContent);

    // Add to queue
    const queueItem = queueManager.addItem({
      file: {
        name: `Export: ${path.basename(videoPath)}`,
        size: fs.statSync(videoPath).size,
        type: "video/mp4",
      },
    });

    // Store export metadata
    exportMetadata.set(queueItem.id, {
      assPath,
      outputPath,
      videoPath,
      sampleDuration: sampleDuration || undefined,
      ffmpegConfig: config.ffmpeg,
    });

    // Start processing the job
    processExportJob(queueItem.id);

    return NextResponse.json({
      success: true,
      queueItemId: queueItem.id,
      message: `Export job added${sampleDuration ? ` (${sampleDuration}s sample)` : ''}`
    });

  } catch (error: any) {
    console.error("[Export API] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function processExportJob(queueItemId: string) {
  const metadata = exportMetadata.get(queueItemId);
  if (!metadata) {
    queueManager.failItem(queueItemId, "Missing export metadata", false);
    return;
  }

  try {
    queueManager.updateItem(queueItemId, {
      status: "processing",
      startedAt: Date.now(),
      progress: 0
    });

    await burnSubtitles(metadata.videoPath, metadata.assPath, metadata.outputPath, {
      sampleDuration: metadata.sampleDuration,
      hwaccel: metadata.ffmpegConfig.hwaccel,
      preset: metadata.ffmpegConfig.preset,
      crf: metadata.ffmpegConfig.crf,
      resolution: metadata.ffmpegConfig.resolution,
      onProgress: (percent: number) => {
        queueManager.updateProgress(queueItemId, percent);
      },
    });

    // Complete the job
    queueManager.completeItem(queueItemId, { 
      videoPath: metadata.outputPath 
    });
    
  } catch (error: any) {
    console.error(`[Export Processor] Job ${queueItemId} failed:`, error);
    queueManager.failItem(queueItemId, error.message || "Internal FFmpeg error", false);
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const item = queueManager.getItem(id);
  if (!item || !item.result?.videoPath) {
    return NextResponse.json({ error: "Export result not found" }, { status: 404 });
  }

  const filePath = item.result.videoPath;
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File vanished from storage" }, { status: 410 });
  }

  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}