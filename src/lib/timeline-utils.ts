/**
 * timeline-utils.ts - Core timeline calculation utilities for multi-video projects
 * 
 * These functions handle the conversion between:
 * - Project time: Absolute position on the project timeline
 * - Source time: Position within a video clip's source file
 * - Relative subtitle time: Time relative to a clip's start (0-based)
 */

import { SubtitleLine, VideoClip, TimelineClip } from '@/types/subtitle';

/**
 * Calculate the absolute project time for a subtitle within a clip.
 * 
 * @param subtitleTime - Time relative to the video clip's start (0-based)
 * @param clip - The TimelineClip containing this subtitle
 * @returns Absolute project timeline time in seconds
 * 
 * @example
 * // Clip starts at 8:00 in project, subtitle at 0:05 relative to clip
 * const projectTime = toProjectTime(5, { projectStartTime: 480, ... });
 * // Returns 485 (8:05)
 */
export function toProjectTime(subtitleTime: number, clip: TimelineClip): number {
  return clip.projectStartTime + subtitleTime;
}

/**
 * Calculate the source video time from a project time position.
 * 
 * @param projectTime - Absolute position on project timeline
 * @param clip - The TimelineClip to translate into
 * @returns Position within the source video file, or null if outside clip bounds
 * 
 * @example
 * // Clip at project 8:00, inPoint at 10s, duration 30s
 * // Project time 8:15 -> source time 25s (10 + 15)
 */
export function toSourceTime(projectTime: number, clip: TimelineClip): number | null {
  const timeInClip = projectTime - clip.projectStartTime;
  
  // Check if projectTime is within this clip's bounds
  if (timeInClip < 0 || timeInClip > clip.clipDuration) {
    return null;
  }
  
  return clip.sourceInPoint + timeInClip;
}

/**
 * Get the end time of a timeline clip on the project timeline.
 */
export function getClipEndTime(clip: TimelineClip): number {
  return clip.projectStartTime + clip.clipDuration;
}

/**
 * Calculate total project duration from all timeline clips.
 */
export function getProjectDuration(timeline: TimelineClip[]): number {
  if (timeline.length === 0) return 0;
  
  return Math.max(...timeline.map(clip => getClipEndTime(clip)));
}

/**
 * Find which timeline clip is active at a given project time.
 * 
 * @param timeline - Array of timeline clips
 * @param projectTime - Absolute position on project timeline
 * @returns The active TimelineClip or null if none
 */
export function getActiveClipAt(timeline: TimelineClip[], projectTime: number): TimelineClip | null {
  return timeline.find(clip => {
    const start = clip.projectStartTime;
    const end = getClipEndTime(clip);
    return projectTime >= start && projectTime < end;
  }) || null;
}

/**
 * Find the VideoClip by ID from the clips library.
 */
export function getVideoClip(clips: VideoClip[], videoClipId: string): VideoClip | undefined {
  return clips.find(clip => clip.id === videoClipId);
}

/**
 * A subtitle with its source clip information attached.
 */
export interface FlattenedSubtitle extends SubtitleLine {
  sourceClipId: string;
  projectStartTime: number;
  projectEndTime: number;
}

/**
 * Get all subtitles flattened to project timeline coordinates.
 * 
 * @param clips - Video clip library
 * @param timeline - Timeline arrangement
 * @returns Array of subtitles with absolute project times
 */
export function getFlattenedSubtitles(
  clips: VideoClip[],
  timeline: TimelineClip[]
): FlattenedSubtitle[] {
  const result: FlattenedSubtitle[] = [];
  
  for (const timelineClip of timeline) {
    const videoClip = getVideoClip(clips, timelineClip.videoClipId);
    if (!videoClip) continue;
    
    for (const subtitle of videoClip.subtitles) {
      // Check if subtitle falls within the clip's used portion
      const subtitleWithinClip = 
        subtitle.startTime >= timelineClip.sourceInPoint &&
        subtitle.startTime < timelineClip.sourceInPoint + timelineClip.clipDuration;
      
      if (!subtitleWithinClip) continue;
      
      // Calculate offset from inPoint
      const offsetFromInPoint = subtitle.startTime - timelineClip.sourceInPoint;
      const projectStartTime = timelineClip.projectStartTime + offsetFromInPoint;
      
      const endOffset = subtitle.endTime - timelineClip.sourceInPoint;
      const projectEndTime = timelineClip.projectStartTime + 
        Math.min(endOffset, timelineClip.clipDuration);
      
      result.push({
        ...subtitle,
        sourceClipId: videoClip.id,
        projectStartTime,
        projectEndTime,
      });
    }
  }
  
  // Sort by project start time
  return result.sort((a, b) => a.projectStartTime - b.projectStartTime);
}

/**
 * Validate that timeline clips don't overlap.
 * 
 * @param timeline - Timeline arrangement to validate
 * @returns Array of overlapping clip pairs, or empty if valid
 */
export function findOverlappingClips(timeline: TimelineClip[]): Array<[TimelineClip, TimelineClip]> {
  const overlaps: Array<[TimelineClip, TimelineClip]> = [];
  
  for (let i = 0; i < timeline.length; i++) {
    for (let j = i + 1; j < timeline.length; j++) {
      const a = timeline[i];
      const b = timeline[j];
      
      const aEnd = getClipEndTime(a);
      const bEnd = getClipEndTime(b);
      
      // Overlap if one starts before the other ends
      if (a.projectStartTime < bEnd && b.projectStartTime < aEnd) {
        overlaps.push([a, b]);
      }
    }
  }
  
  return overlaps;
}

/**
 * Calculate optimal clip positions without gaps or overlaps.
 * Arranges clips sequentially in the order they appear in the array.
 * 
 * @param timeline - Timeline clips to arrange
 * @returns New array with updated projectStartTime values
 */
export function arrangeSequentially(timeline: TimelineClip[]): TimelineClip[] {
  let currentTime = 0;
  
  return timeline.map(clip => {
    const arranged = {
      ...clip,
      projectStartTime: currentTime,
    };
    currentTime += clip.clipDuration;
    return arranged;
  });
}
