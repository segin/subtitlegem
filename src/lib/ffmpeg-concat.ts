import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { MultiVideoProjectState, ProjectConfig, TimelineClip, TimelineImage, VideoClip, ImageAsset } from '@/types/subtitle';
import { getClipEndTime, getProjectDuration, toProjectTime } from './timeline-utils';

export interface BurnOptions {
  hwaccel?: 'nvenc' | 'amf' | 'qsv' | 'videotoolbox' | 'vaapi' | 'v4l2m2m' | 'rkmpp' | 'omx' | 'none';
  preset?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
  crf?: number;
  resolution?: string; // Not typically used for multi-video export as project config defines this
  onProgress?: (progress: number, details?: any) => void;
}

/**
 * Helper to escape FFmpeg filter parameters
 */
function escapeFilterArg(arg: string): string {
  return arg.replace(/'/g, "'\\''").replace(/:/g, '\\:');
}

/**
 * Generate FFmpeg filter_complex for multi-clip project
 */
export function generateFilterComplex(
  inputs: Array<{ type: 'video' | 'image'; path: string; id: string }>,
  timelineClips: Array<TimelineClip | TimelineImage>,
  projectConfig: ProjectConfig
): { filterGraph: string; map: string } {
  const filters: string[] = [];
  const concatVideoSegments: string[] = [];
  const concatAudioSegments: string[] = [];

  const { width: masterWidth, height: masterHeight } = projectConfig;

  // sort timeline items by start time to ensure correct concat order
  // although timeline.sort() might be enough, let's be safe
  const sortedItems = [...timelineClips].sort((a, b) => a.projectStartTime - b.projectStartTime);
  
  // Fill gaps with black/silent
  let currentTime = 0;
  let segmentIndex = 0;
  
  // Filter chains for each segment
  sortedItems.forEach((item) => {
    // Check for gap
    if (item.projectStartTime > currentTime) {
      const gapDuration = item.projectStartTime - currentTime;
      // Add black video gap
      filters.push(`color=s=${masterWidth}x${masterHeight}:c=black:d=${gapDuration}[gapv${segmentIndex}]`);
      // Add silent audio gap
      filters.push(`anullsrc=cl=stereo:r=44100:d=${gapDuration}[gapa${segmentIndex}]`);
      
      concatVideoSegments.push(`[gapv${segmentIndex}]`);
      concatAudioSegments.push(`[gapa${segmentIndex}]`);
      segmentIndex++;
    }
    
    // Find input index
    let inputIndex = -1;
    let isImage = false;
    
    if ('videoClipId' in item) {
       // Video Clip
       const clip = item as TimelineClip;
       inputIndex = inputs.findIndex(i => i.id === clip.videoClipId && i.type === 'video');
    } else {
       // Image
       const img = item as TimelineImage;
       inputIndex = inputs.findIndex(i => i.id === img.imageAssetId && i.type === 'image');
       isImage = true;
    }
    
    if (inputIndex === -1) {
      console.warn(`Could not find input for timeline item ${item.id}`);
      return; 
    }

    const inputLabel = `${inputIndex}`;
    const videoOutLabel = `v${segmentIndex}`;
    const audioOutLabel = `a${segmentIndex}`;

    // Processing chain for this segment
    let vChain = `[${inputLabel}:v]`;
    let aChain = !isImage ? `[${inputLabel}:a]` : null;

    // 1. Trim (if video) or loop/trim (if image)
    if (isImage) {
        // Images are looped inputs usually, but we need to trim the duration we want
        // Actually, for image inputs we usually use -loop 1 -t <duration> in input args or trim filter
        // We handle input args separately. Assuming infinite loop input, we trim here.
        // But better: use trim on the filter
        const duration = (item as TimelineImage).duration;
        // Also need to set fps to match project
        // scale first, then setsar, then fps
        // BUT: Images don't have timebases like videos.
        // We will scale first.
    } else {
        const clip = item as TimelineClip;
        vChain += `trim=start=${clip.sourceInPoint}:duration=${clip.clipDuration},setpts=PTS-STARTPTS`;
        if (aChain) {
            aChain += `atrim=start=${clip.sourceInPoint}:duration=${clip.clipDuration},asetpts=PTS-STARTPTS`;
        }
    }

    // 2. Scale and Pad to match Project Config
    // scalingMode: 'fit' | 'fill' | 'stretch'
    const scaleFilter = projectConfig.scalingMode === 'stretch' 
        ? `scale=${masterWidth}:${masterHeight},setsar=1`
        : projectConfig.scalingMode === 'fill'
            ? `scale=${masterWidth}:${masterHeight}:force_original_aspect_ratio=increase,crop=${masterWidth}:${masterHeight},setsar=1`
            : `scale=${masterWidth}:${masterHeight}:force_original_aspect_ratio=decrease,pad=${masterWidth}:${masterHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1`; // fit/default
            
    vChain += `,${scaleFilter}`;
    
    // 3. Frame rate compliance
    vChain += `,fps=${projectConfig.fps}`;
    
    vChain += `[${videoOutLabel}]`;
    filters.push(vChain);
    concatVideoSegments.push(`[${videoOutLabel}]`);

    // Audio handling for Image or Video
    if (isImage) {
       // Generate silent audio for image duration
       const duration = (item as TimelineImage).duration;
       filters.push(`anullsrc=cl=stereo:r=44100:d=${duration}[${audioOutLabel}]`);
       concatAudioSegments.push(`[${audioOutLabel}]`);
    } else {
        // Video audio
        // Just normalize format if needed? Assuming stereo 44100 for simplicity for now
        // But concat requires matching streams. aformat helps.
        if (aChain) {
             aChain += `,aformat=sample_rates=44100:channel_layouts=stereo[${audioOutLabel}]`;
             filters.push(aChain);
             concatAudioSegments.push(`[${audioOutLabel}]`);
        } else {
            // Case where video has no audio stream? 
            // Fallback to silence
             const duration = (item as TimelineClip).clipDuration;
             filters.push(`anullsrc=cl=stereo:r=44100:d=${duration}[${audioOutLabel}]`);
             concatAudioSegments.push(`[${audioOutLabel}]`);
        }
    }

    currentTime = item.projectStartTime + (('clipDuration' in item) ? (item as TimelineClip).clipDuration : (item as TimelineImage).duration);
    segmentIndex++;
  });

  // Concat everything
  const n = concatVideoSegments.length;
  filters.push(`${concatVideoSegments.join('')}${concatAudioSegments.join('')}concat=n=${n}:v=1:a=1[vconcat][aconcat]`);
  
  return {
    filterGraph: filters.join(';'),
    map: '[vconcat][aconcat]' 
  };
}


/**
 * Export a multi-video project to a single file
 */
export async function exportMultiVideo(
  project: MultiVideoProjectState,
  assPath: string,
  outputPath: string,
  options: BurnOptions
): Promise<string> {
    return new Promise((resolve, reject) => {
        const { 
            hwaccel = 'none', 
            preset = 'veryfast', 
            crf = 23, 
            onProgress 
        } = options;

        // Prepare Inputs
        const inputArgs: string[] = [];
        const inputs: Array<{ type: 'video' | 'image'; path: string; id: string }> = [];

        // Combine project videos and images to map them to input indices
        // We only care about assets actually used on the timeline? 
        // Or we can just map the library. 
        // For efficiency, let's map what we have in the state.
        
        project.clips.forEach(clip => {
            // Check if used? Not strictly necessary but efficient. 
            // We'll stick to naive approach: input everything.
            // Using -loop 1 for images effectively turns them into video streams
            // We'll handle images from the imageAssets array
            if (!inputs.find(i => i.id === clip.id)) {
                inputs.push({ type: 'video', path: clip.filePath, id: clip.id });
                inputArgs.push('-i', clip.filePath);
            }
        });

        if (project.imageAssets) {
            project.imageAssets.forEach(img => {
                 if (!inputs.find(i => i.id === img.id)) {
                     inputs.push({ type: 'image', path: img.filePath, id: img.id });
                     // Loop image inputs so they can be trimmed to any duration
                     inputArgs.push('-loop', '1', '-t', '3600', '-i', img.filePath); // Hardcap 1 hour per image to prevent infinite logic issues if trim fails
                 }
            });
        }
        
        // Combine timeline clips and images
        const timelineItems: Array<TimelineClip | TimelineImage> = [
            ...project.timeline,
            ...(project.timelineImages || [])
        ];
        
        // Generate Filter Complex
        const { filterGraph, map } = generateFilterComplex(inputs, timelineItems, project.projectConfig);
        
        // Append subtitle burn to the video stream of the concat result
        // We take [vconcat], burn subtitles, output to [vfinal]
        const escapedAssPath = escapeFilterArg(assPath);
        // Note: subtitles filter works on the video stream.
        // We append it to the filter graph.
        const finalFilterGraph = `${filterGraph};[vconcat]subtitles=${escapedAssPath}[vfinal]`;

        const args = [
            ...inputArgs,
            '-filter_complex', finalFilterGraph,
            '-map', '[vfinal]', // Video from subtitles filter
            '-map', '[aconcat]', // Audio from concat
        ];
        
        // Encoder options
        const encoderMap: Record<string, string> = {
            nvenc: 'h264_nvenc',
            amf: 'h264_amf',
            qsv: 'h264_qsv',
            videotoolbox: 'h264_videotoolbox',
            vaapi: 'h264_vaapi',
            v4l2m2m: 'h264_v4l2m2m',
            rkmpp: 'h264_rkmpp',
            omx: 'h264_omx',
            none: 'libx264',
        };

        const videoCodec = encoderMap[hwaccel] || 'libx264';
        args.push('-c:v', videoCodec);

        if (videoCodec === 'libx264') {
            args.push('-preset', preset);
            args.push('-crf', crf.toString());
        }

        // Audio codec
        args.push('-c:a', 'aac', '-b:a', '192k');

        // Overwrite
        args.push('-y', outputPath);

        console.log(`[FFmpeg-Concat] Spawning: ffmpeg ${args.join(' ')}`);

        const proc = spawn('ffmpeg', args);
        let stderr = '';
        const totalDuration = getProjectDuration(project.timeline, project.timelineImages || []);

        proc.stderr.on('data', (data) => {
            const line = data.toString();
            stderr += line;

            if (onProgress && totalDuration > 0) {
                const match = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
                if (match) {
                    const hours = parseInt(match[1]);
                    const minutes = parseInt(match[2]);
                    const seconds = parseInt(match[3]);
                    const centiseconds = parseInt(match[4]);
                    const current = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
                    
                    const percent = Math.min((current / totalDuration) * 100, 100);
                    onProgress(percent, { timemark: line });
                }
            }
        });

        proc.on('close', (code) => {
            if (code !== 0) {
                console.error(`[FFmpeg-Concat] Error:`, stderr);
                return reject(new Error(`FFmpeg concat failed with code ${code}`));
            }
            resolve(outputPath);
        });

        proc.on('error', (err) => {
           reject(new Error(`FFmpeg spawn error: ${err.message}`));
        });
    });
}
