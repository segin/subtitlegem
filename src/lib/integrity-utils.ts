import { VideoClip } from '@/types/subtitle';

export enum IntegrityStatus {
  OK = 'OK',
  MISSING = 'MISSING',
  MISMATCH = 'MISMATCH', // Exists but size differs
}

/**
 * Checks the integrity of a video clip against a measured file size.
 * @param clip The video clip metadata
 * @param measuredSize The actual size of the file on disk (or null if not found)
 */
export function checkClipIntegrity(clip: VideoClip, measuredSize: number | null): IntegrityStatus {
  if (measuredSize === null) {
    return IntegrityStatus.MISSING;
  }

  // If no fileSize was recorded (legacy clip), assume OK but maybe we should update it?
  // For strict integrity tracking, if we expect tracking and it's missing, treat as OK for now 
  // until we save it, OR return OK and let caller update.
  // Requirement: "If the size on disk is ever different from what's recorded..."
  
  if (clip.fileSize === undefined || clip.fileSize === null) {
    // Legacy case: we accept it, but caller should probably update the DB record.
    return IntegrityStatus.OK;
  }

  if (clip.fileSize !== measuredSize) {
    return IntegrityStatus.MISMATCH;
  }

  return IntegrityStatus.OK;
}

/**
 * Validates if a replacement file is suitable for re-linking.
 * Requirement: "reupload with same filename and size"
 */
export function canRelinkClip(clip: VideoClip, candidateFilename: string, candidateSize: number): boolean {
  // Filename check (case-insensitive? specific requirements say "same filename")
  if (clip.originalFilename !== candidateFilename) {
    // Ideally we might be more flexible, but user req says "same filename"
    return false;
  }

  // Size check
  if (clip.fileSize !== undefined && clip.fileSize !== candidateSize) {
    return false;
  }

  return true;
}
