import { NextRequest, NextResponse } from "next/server";
import { queueManager } from "@/lib/queue-manager";
import { burnSubtitles } from "@/lib/ffmpeg-utils";
import { generateAss } from "@/lib/ass-utils";
import { SubtitleLine, SubtitleConfig, FFmpegConfig } from "@/types/subtitle";
import fs from "fs";
import path from "path";
import os from "os";
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

    if (!videoPath) {
      return NextResponse.json({ error: "Missing video path" }, { status: 400 });
    }

    if (!fs.existsSync(videoPath)) {
      return NextResponse.json({ error: "Video file not found" }, { status: 404 });
    }

    if (!subtitles || subtitles.length === 0) {
      return NextResponse.json({ error: "No subtitles to export" }, { status: 400 });
    }

    const stagingDir = process.env.STAGING_DIR || path.join(os.tmpdir(), 'subtitlegem');
    if (!fs.existsSync(stagingDir)) {
      fs.mkdirSync(stagingDir, { recursive: true });
    }

    const jobId = uuidv4();
    const assPath = path.join(stagingDir, `${jobId}.ass`);
    const fileName = path.basename(videoPath, path.extname(videoPath));
    const suffix = sampleDuration ? `_sample_${sampleDuration}s` : '';
    const outputPath = path.join(stagingDir, `${fileName}${suffix}_subtitled.mp4`);

    // Generate ASS subtitle file
    const assContent = generateAss(subtitles, config);
    fs.writeFileSync(assPath, assContent, 'utf-8');

    // Get file info
    const fileStats = fs.statSync(videoPath);

    // Add to queue
    const queueItem = queueManager.addItem({
      file: {
        name: `${fileName}${suffix}.mp4`,
        size: fileStats.size,
        path: videoPath,
      },
      model: 'export',
      secondaryLanguage: 'export',
      sampleDuration: sampleDuration || undefined,
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
      message: `Export job added${sampleDuration ? ` (${sampleDuration}s sample)` : ''}`,
    });

  } catch (error: any) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create export job" },
      { status: 500 }
    );
  }
}

// Process export job in background
async function processExportJob(queueItemId: string) {
  const metadata = exportMetadata.get(queueItemId);
  if (!metadata) {
    queueManager.failItem(queueItemId, "Export metadata not found", false, 'unknown');
    return;
  }

  try {
    queueManager.updateItem(queueItemId, {
      status: 'processing',
      progress: 0,
      startedAt: Date.now(),
    });

    await burnSubtitles(metadata.videoPath, metadata.assPath, metadata.outputPath, {
      sampleDuration: metadata.sampleDuration,
      hwaccel: metadata.ffmpegConfig.hwaccel,
      preset: metadata.ffmpegConfig.preset,
      crf: metadata.ffmpegConfig.crf,
      onProgress: (percent: number) => {
        queueManager.updateItem(queueItemId, {
          progress: Math.round(percent),
        });
      },
    });

    queueManager.completeItem(queueItemId, {
      subtitles: [],
      videoPath: metadata.outputPath,
    });

    // Cleanup ASS file
    if (fs.existsSync(metadata.assPath)) {
      fs.unlinkSync(metadata.assPath);
    }

    exportMetadata.delete(queueItemId);

  } catch (error: any) {
    console.error(`Export job ${queueItemId} failed:`, error);
    queueManager.failItem(queueItemId, error.message || "Export failed", true, 'api_error');
  }
}

// GET endpoint to download completed export
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('id');

  if (!jobId) {
    return NextResponse.json({ error: "Missing job ID" }, { status: 400 });
  }

  const items = queueManager.getAllItems();
  const item = items.find(i => i.id === jobId);

  if (!item) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (item.status !== 'completed') {
    return NextResponse.json({ error: "Job not completed" }, { status: 400 });
  }

  if (!item.result?.videoPath || !fs.existsSync(item.result.videoPath)) {
    return NextResponse.json({ error: "Output file not found" }, { status: 404 });
  }

  // Stream the file
  const fileBuffer = fs.readFileSync(item.result.videoPath);
  const fileName = path.basename(item.result.videoPath);

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': fileBuffer.length.toString(),
    },
  });
}