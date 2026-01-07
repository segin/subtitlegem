import { NextRequest, NextResponse } from "next/server";
import { queueManager } from "@/lib/queue-manager";
import { burnSubtitles, getVideoDimensions } from "@/lib/ffmpeg-utils";
import { generateAss, VideoDimensions } from "@/lib/ass-utils";
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
  filename?: string;
}

// Metadata store for export jobs (extends queue items with export-specific data)
// REMOVED: exportMetadata - now using queue item metadata (SQLite)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const stagingDir = getStagingDir();

    // Check for Multi-Video Project (V2)
    if (body.project && body.project.version === 2) {
       const { project, sampleDuration, filename } = body;
       const { getFlattenedSubtitles } = await import("@/lib/timeline-utils");
       
       console.log(`[Export] Processing multi-video project (v2) with ${project.clips.length} clips`);
       
       // Security Check: Validate ALL paths in project clips and image assets
       const { isPathSafe } = await import("@/lib/storage-config");
       
       for (const clip of project.clips) {
           if (!isPathSafe(clip.filePath)) {
               console.warn(`[Export] Blocked unauthorized clip path: ${clip.filePath}`);
               return NextResponse.json({ error: 'Unauthorized path in project clips' }, { status: 403 });
           }
       }

       if (project.imageAssets) {
           for (const img of project.imageAssets) {
               if (!isPathSafe(img.filePath)) {
                   console.warn(`[Export] Blocked unauthorized image path: ${img.filePath}`);
                   return NextResponse.json({ error: 'Unauthorized path in project images' }, { status: 403 });
               }
           }
       }

       // Generate flattened subtitles using the unified timeline model
       const flattenedSubtitles = getFlattenedSubtitles(project.clips, project.timeline);
       
       // Generate unique ID
       const jobId = uuidv4();
       const exportDir = path.join(stagingDir, "exports", jobId);
       if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

       const assPath = path.join(exportDir, "subtitles.ass");
       const safeBaseName = (filename || 'project').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
       const outputName = `${safeBaseName}_export_${Date.now()}.mp4`;
       const outputPath = path.join(exportDir, outputName);

       // Video Dimensions from Project Config
       const videoDimensions: VideoDimensions = {
           width: project.projectConfig.width,
           height: project.projectConfig.height
       };

       // Generate ASS
       const assContent = generateAss(flattenedSubtitles, project.subtitleConfig, videoDimensions);
       fs.writeFileSync(assPath, assContent);

       // Queue Job
       const queueItem = queueManager.addItem({
          file: {
             name: `Export: ${filename || 'Multi-Video Project'}`,
             size: 0, // Unknown/Irrelevant for multi-video
             type: "video/mp4"
          },
          model: `Export: ${filename || 'Project'}`,
          metadata: {
             type: 'multi-export',
             projectState: project,
             assPath,
             outputPath,
             // Dummy videoPath for validation inside job-processor if needed
             videoPath: project.clips[0]?.filePath || '', 
             sampleDuration: sampleDuration || undefined,
             ffmpegConfig: project.subtitleConfig.ffmpeg
          }
       });
       
       if (!queueManager.isProcessing() && !queueManager.getPausedState()) {
          queueManager.resume();
       }

       return NextResponse.json({
          success: true,
          queueItemId: queueItem.id,
          message: `Multi-video export job added`
       });
    }

    // Single Video Export (Legacy/Simple)
    const { videoPath, subtitles, config, sampleDuration, filename }: ExportRequest = body;

    if (!videoPath) {
      return NextResponse.json({ error: "Missing video path" }, { status: 400 });
    }

    // Security check: strict path validation
    const { isPathSafe } = await import("@/lib/storage-config");
    if (!isPathSafe(videoPath)) {
        console.warn(`[Export] Blocked unauthorized path access: ${videoPath}`);
        return NextResponse.json({ error: 'Unauthorized path' }, { status: 403 });
    }

    const resolvedPath = path.resolve(videoPath);
    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: "Video file not found" }, { status: 404 });
    }

    // Generate unique ID for this export job
    const jobId = uuidv4();
    const exportDir = path.join(stagingDir, "exports", jobId);
    
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const assPath = path.join(exportDir, "subtitles.ass");
    
    // Construct readable output filename
    // Fallback to basename if no original filename provided
    const baseName = filename 
        ? path.basename(filename, path.extname(filename)) 
        : path.basename(videoPath, path.extname(videoPath));
        
    // Clean string (alphanumeric + safe chars) to prevent FS issues
    const safeBaseName = baseName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    
    const outputName = `${safeBaseName}_export_${Date.now()}.mp4`; // Unique output name
    const outputPath = path.join(exportDir, outputName);

    // Get video dimensions for proper ASS PlayRes scaling
    let videoDimensions: VideoDimensions | undefined;
    try {
      videoDimensions = await getVideoDimensions(videoPath);
      console.log(`[Export] Video dimensions: ${videoDimensions.width}x${videoDimensions.height}`);
    } catch (e) {
      console.warn('[Export] Could not get video dimensions, using default 1920x1080:', e);
    }

    // Generate ASS file with actual video dimensions
    const assContent = generateAss(subtitles, config, videoDimensions);
    fs.writeFileSync(assPath, assContent);

    // Add to queue with persistent metadata
    const queueItem = queueManager.addItem({
      file: {
        name: `Export: ${filename || path.basename(videoPath)}`,
        size: fs.statSync(videoPath).size,
        type: "video/mp4",
      },
      model: `Export: ${filename || 'Video'}`, // Readable display name for Queue
      metadata: {
        assPath,
        outputPath,
        videoPath,
        sampleDuration: sampleDuration || undefined,
        ffmpegConfig: config.ffmpeg,
      }
    });

    // We don't need to manually start processing here anymore.
    // QueueManager's addItem triggers processNext() if autoStart is on, 
    // or if the queue is already running.
    // However, to ensure it starts if this is the first item:
    if (!queueManager.isProcessing() && !queueManager.getPausedState()) {
      queueManager.resume(); // Starts processing
    }

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