import { REFERENCE_WIDTH, REFERENCE_HEIGHT, DEFAULT_FPS } from './constants';

export interface SubtitleLine {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
  secondaryText?: string;
  // Deprecated: use styleOverrides instead
  primaryColor?: string;
  secondaryColor?: string;
  
  // Per-line specific overrides (sparse)
  styleOverrides?: Partial<TrackStyle>;
}

// FFmpeg ASS Alignment (numpad layout):
// 7 8 9    (top)
// 4 5 6    (middle)
// 1 2 3    (bottom)
//
// BUT some FFmpeg versions use different values!
// Verify with: ffmpeg -h filter=subtitles
export type Alignment = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface TrackStyle {
  alignment: Alignment;
  /** Font size as percentage of video height (e.g., 5 = 5% of video height) */
  fontSize: number;
  color: string; // Hex format #RRGGBB
  fontFamily: string;
  /** Vertical margin as percentage of video height */
  marginV: number;
  /** Horizontal margin as percentage of video width */
  marginH: number;
  backgroundColor: string; // rgba() format for transparency
  outlineColor?: string; // Optional outline color
  /** Outline width as percentage of video height */
  outlineWidth?: number;
}


export interface FFmpegConfig {
  hwaccel: 'nvenc' | 'amf' | 'qsv' | 'videotoolbox' | 'vaapi' | 'v4l2m2m' | 'rkmpp' | 'omx' | 'none';
  preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
  crf: number;
  resolution: string; // 'original' or 'WIDTHxHEIGHT'
}

export interface SubtitleConfig {
  // Styles can be partial for inheritance or full for defaults
  primary?: Partial<TrackStyle>;
  secondary?: Partial<TrackStyle>;
  
  ffmpeg: FFmpegConfig;
  primaryLanguage?: string;
  secondaryLanguage?: string;
  geminiFileUri?: string | null;
  geminiFileExpiration?: string | null;
  fileId?: string | null;
  originalFilename?: string | null;
  geminiModel?: string;
}

export const DEFAULT_CONFIG: SubtitleConfig = {
  primaryLanguage: 'English',
  secondaryLanguage: 'Secondary',
  // Default to empty to inherit from Global Settings
  primary: {}, 
  secondary: {},
  ffmpeg: {
    hwaccel: 'none',
    preset: 'veryfast',
    crf: 23,
    resolution: 'original',
  }
};

// Human-readable alignment labels for UI
export const ALIGNMENT_LABELS: Record<Alignment, string> = {
  1: 'Bottom Left',
  2: 'Bottom Center',
  3: 'Bottom Right',
  4: 'Middle Left',
  5: 'Middle Center',
  6: 'Middle Right',
  7: 'Top Left',
  8: 'Top Center',
  9: 'Top Right',
};

export interface ProjectState {
  version: number;
  timestamp: number;
  videoPath: string | null;
  subtitles: SubtitleLine[];
  config: SubtitleConfig;
}

// ============================================================================
// Multi-Video Project Types (V2)
// ============================================================================

/**
 * A video clip in the project library.
 * Contains the source file info and its associated subtitles.
 */
export interface VideoClip {
  /** Unique identifier for this clip */
  id: string;
  /** Path to video file on server */
  filePath: string;
  /** Original filename for display */
  originalFilename: string;
  
  /** Video metadata */
  duration: number;        // Total duration of source file in seconds
  width: number;
  height: number;
  fps?: number;
  
  /** File Integrity Tracking */
  fileSize?: number; // Size in bytes on disk
  missing?: boolean; // True if file is missing or size mismatch
  
  /** Gemini API references for re-processing */
  geminiFileUri?: string | null;
  geminiFileExpiration?: string | null;
  fileId?: string | null;
  
  /** Subtitles for THIS clip (times relative to clip start at 0) */
  subtitles: SubtitleLine[];
  
  /** Per-clip subtitle config overrides (merged with project config) */
  subtitleConfig?: Partial<SubtitleConfig>;
}

/**
 * A video clip placed on the project timeline.
 * References a VideoClip from the library and specifies how it's used.
 */
export interface TimelineClip {
  /** Unique identifier for this timeline placement */
  id: string;
  /** Reference to VideoClip.id in the library */
  videoClipId: string;
  
  /** Position on project timeline where this clip starts (seconds) */
  projectStartTime: number;
  /** In-point within source video (seconds) - where to start playback */
  sourceInPoint: number;
  /** Duration to use from source (seconds, starting from inPoint) */
  clipDuration: number;
}

/**
 * An image asset that can be placed on the timeline.
 * Images display for a set duration (video gaps are black/silent by default).
 */
export interface ImageAsset {
  id: string;
  /** Path to image file on server */
  filePath: string;
  /** Original filename for display */
  originalFilename: string;
  /** Image dimensions */
  width: number;
  height: number;
}

/**
 * An image placed on the timeline (fills gaps between video clips).
 */
export interface TimelineImage {
  id: string;
  type: 'image';
  /** Reference to ImageAsset.id in the assets library */
  imageAssetId: string;
  /** Position on project timeline where this image starts (seconds) */
  projectStartTime: number;
  /** Duration to display the image (seconds) */
  duration: number;
}

/**
 * Union type for all items that can be on the timeline.
 */
export type TimelineItem = 
  | (TimelineClip & { type?: 'video' })
  | TimelineImage;

/**
 * Master project configuration for multi-video projects.
 * Defines the output format and how clips are composited.
 */
export interface ProjectConfig {
  /** Master resolution (typically from first/primary video) */
  width: number;
  height: number;
  fps: number;
  
  /** How to handle clips that don't match master resolution */
  scalingMode: 'fit' | 'fill' | 'stretch';
}

/**
 * Default project configuration
 */
export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  width: REFERENCE_WIDTH,
  height: REFERENCE_HEIGHT,
  fps: DEFAULT_FPS,
  scalingMode: 'fit',
};

/**
 * Multi-video project state (V2).
 * Supports multiple video clips and images arranged on a timeline.
 */
export interface MultiVideoProjectState {
  /** Version 2 for multi-video format */
  version: 2;
  timestamp: number;
  
  /** Video library - all video clips available in this project */
  clips: VideoClip[];
  
  /** Image library - all image assets available in this project */
  imageAssets?: ImageAsset[];
  
  /** Timeline arrangement - how clips and images are placed */
  timeline: TimelineClip[];
  
  /** Timeline images - images placed in gaps (optional, null gaps = black/silent) */
  timelineImages?: TimelineImage[];
  
  /** Project-level configuration (master resolution, fps, etc.) */
  projectConfig: ProjectConfig;
  
  /** Global subtitle styling for the project */
  subtitleConfig: SubtitleConfig;
}

/**
 * Type guard to check if a project state is V2 (multi-video)
 */
export function isMultiVideoProject(state: ProjectState | MultiVideoProjectState): state is MultiVideoProjectState {
  return state.version === 2 && 'clips' in state && 'timeline' in state;
}

/**
 * Migrate a V1 single-video project to V2 multi-video format
 */
export function migrateToMultiVideo(v1: ProjectState): MultiVideoProjectState {
  const clipId = `clip-${Date.now()}`;
  
  // Create a VideoClip from the single video
  const clip: VideoClip = {
    id: clipId,
    filePath: v1.videoPath || '',
    originalFilename: v1.config.originalFilename || 'Untitled',
    duration: 0, // Will be determined when video is loaded
    width: REFERENCE_WIDTH,
    height: REFERENCE_HEIGHT,
    geminiFileUri: v1.config.geminiFileUri,
    geminiFileExpiration: v1.config.geminiFileExpiration,
    fileId: v1.config.fileId,
    subtitles: v1.subtitles,
  };
  
  // Create a TimelineClip that uses the full video
  const timelineClip: TimelineClip = {
    id: `timeline-${clipId}`,
    videoClipId: clipId,
    projectStartTime: 0,
    sourceInPoint: 0,
    clipDuration: 0, // Will be set to full duration when loaded
  };
  
  return {
    version: 2,
    timestamp: v1.timestamp,
    clips: [clip],
    timeline: [timelineClip],
    projectConfig: DEFAULT_PROJECT_CONFIG,
    subtitleConfig: v1.config,
  };
}

/** Global application settings (persisted across sessions) */
export interface GlobalSettings {
  // Default styles (full TrackStyle objects)
  defaultPrimaryStyle: TrackStyle;
  defaultSecondaryStyle: TrackStyle;
  
  // Default languages
  defaultPrimaryLanguage: string;
  defaultSecondaryLanguage: string;
  
  // Subtitle style mode
  subtitleStyle: 'split' | 'combined';
  
  // Default FFmpeg settings
  defaultHwaccel: string;
  defaultPreset: string;
  defaultCrf: number;
  
  // Default Gemini model
  defaultGeminiModel: string;

  // Safety Re-route (Phase 7)
  aiFallbackChain: ModelConfig[];
}

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'ollama' | 'local';

export interface ModelConfig {
  id: string; // Internal unique ID
  provider: AIProvider;
  modelName: string;
  apiKey?: string;
  endpoint?: string; // For local/custom providers
  enabled: boolean;
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  defaultPrimaryStyle: {
    alignment: 2, // Bottom Center
    fontSize: 5,           // 5% of video height
    color: '#ffffff',
    fontFamily: 'Arial',
    marginV: 4,            // 4% from edge
    marginH: 4,            // 4% horizontal padding
    backgroundColor: 'rgba(0,0,0,0.7)',
    outlineColor: '#000000',
    outlineWidth: 0.2,     // 0.2% outline
  },
  defaultSecondaryStyle: {
    alignment: 8, // Top Center
    fontSize: 4,           // 4% of video height (smaller for secondary)
    color: '#fbbf24',
    fontFamily: 'Arial',
    marginV: 4,
    marginH: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    outlineColor: '#000000',
    outlineWidth: 0.2,
  },

  defaultPrimaryLanguage: 'English',
  defaultSecondaryLanguage: 'Simplified Chinese',
  subtitleStyle: 'split',
  defaultHwaccel: 'none',
  defaultPreset: 'veryfast',
  defaultCrf: 23,
  defaultGeminiModel: 'gemini-2.0-flash',
  aiFallbackChain: [
    {
      id: 'default-gemini',
      provider: 'gemini',
      modelName: 'gemini-2.0-flash',
      enabled: true
    }
  ],
};