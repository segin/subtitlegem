import {
  SubtitleLine,
  SubtitleConfig,
  VideoClip,
  TimelineClip,
  ProjectConfig,
  ImageAsset,
  TimelineImage,
} from "@/types/subtitle";

export interface EditorDraftState {
  draftId: string | null;
  /** Name for a brand-new draft. Ignored for updates so renames aren't undone. */
  newDraftName: string;
  videoPath: string | null;
  subtitles: SubtitleLine[];
  config: SubtitleConfig;
  videoClips: VideoClip[];
  timelineClips: TimelineClip[];
  projectConfig: ProjectConfig;
  imageAssets: ImageAsset[];
  timelineImages: TimelineImage[];
}

/**
 * Put the editor's flat subtitle list back under the source clips it belongs to.
 *
 * In the editor each line's `clipId` is a *timeline* clip ID; drafts store
 * subtitles per *library* clip (in source time). Lines whose clip can't be
 * resolved go to the first clip rather than being dropped.
 */
export function distributeSubtitlesToClips(
  subtitles: SubtitleLine[],
  videoClips: VideoClip[],
  timelineClips: TimelineClip[]
): VideoClip[] {
  if (videoClips.length === 0) return [];

  const timelineToVideo = new Map(timelineClips.map(tc => [tc.id, tc.videoClipId]));
  const videoIds = new Set(videoClips.map(c => c.id));
  const byClip = new Map<string, SubtitleLine[]>(videoClips.map(c => [c.id, []]));

  for (const line of subtitles) {
    let videoClipId = line.clipId ? timelineToVideo.get(line.clipId) : undefined;
    if (!videoClipId && line.clipId && videoIds.has(line.clipId)) videoClipId = line.clipId;
    if (!videoClipId || !byClip.has(videoClipId)) videoClipId = videoClips[0].id;
    byClip.get(videoClipId)!.push(line);
  }

  return videoClips.map(clip => ({ ...clip, subtitles: byClip.get(clip.id) ?? [] }));
}

/**
 * Build the POST /api/drafts body for the editor's current state.
 * Multi-video projects (any library clips) are saved as V2 with clips,
 * timeline, images and project config; otherwise as a single-video V1 draft.
 */
export function buildDraftSaveBody(state: EditorDraftState): Record<string, unknown> {
  const identity = state.draftId
    ? { id: state.draftId }
    : { name: state.newDraftName };

  if (state.videoClips.length > 0) {
    return {
      ...identity,
      version: 2,
      clips: distributeSubtitlesToClips(state.subtitles, state.videoClips, state.timelineClips),
      timeline: state.timelineClips,
      projectConfig: state.projectConfig,
      subtitleConfig: state.config,
      imageAssets: state.imageAssets,
      timelineImages: state.timelineImages,
    };
  }

  return {
    ...identity,
    videoPath: state.videoPath,
    subtitles: state.subtitles,
    config: state.config,
  };
}
