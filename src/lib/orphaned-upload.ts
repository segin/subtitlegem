/**
 * Saves a processed upload whose page disconnected before it could receive
 * the result (phone asleep, tab closed), so the work shows up in Drafts.
 */
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { saveDraftV2, DraftV2 } from "./draft-store";
import { buildSequentialTimeline } from "./timeline-utils";
import { ProjectConfig, SubtitleConfig, SubtitleLine, VideoClip } from "@/types/subtitle";

export interface OrphanedUpload {
  videoPath: string;
  originalFilename: string;
  fileSize: number;
  subtitles: SubtitleLine[];
  detectedLanguage?: string | null;
  secondaryLanguage?: string;
  duration?: number;
  width?: number;
  height?: number;
  geminiFileUri?: string | null;
  geminiFileExpiration?: string | null;
  fileId?: string | null;
}

export function saveOrphanedUpload(upload: OrphanedUpload): DraftV2 {
  const clip: VideoClip = {
    id: uuidv4(),
    filePath: upload.videoPath,
    originalFilename: upload.originalFilename,
    duration: upload.duration ?? 0,
    width: upload.width ?? 0,
    height: upload.height ?? 0,
    fileSize: upload.fileSize,
    geminiFileUri: upload.geminiFileUri ?? null,
    geminiFileExpiration: upload.geminiFileExpiration ?? null,
    fileId: upload.fileId ?? null,
    subtitles: upload.subtitles,
  };

  const name = path.parse(upload.originalFilename).name || "Recovered upload";

  // Same shape the upload page saves; the editor fills in defaults on load
  return saveDraftV2({
    name,
    clips: [clip],
    timeline: buildSequentialTimeline([clip]),
    projectConfig: {} as ProjectConfig,
    subtitleConfig: {
      primaryLanguage: upload.detectedLanguage || 'English',
      ...(upload.secondaryLanguage && upload.secondaryLanguage !== 'None' && { secondaryLanguage: upload.secondaryLanguage }),
    } as SubtitleConfig,
  });
}
