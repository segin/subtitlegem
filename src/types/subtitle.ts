export interface SubtitleLine {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
  secondaryText?: string;
  primaryColor?: string;   // Optional override (Hex #RRGGBB)
  secondaryColor?: string; // Optional override (Hex #RRGGBB)
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
  /** Font size as percentage of video height (e.g., 2.5 = 2.5%) */
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
  /** Shadow distance as percentage of video height */
  shadowDistance?: number;
}

export interface FFmpegConfig {
  hwaccel: 'nvenc' | 'amf' | 'qsv' | 'videotoolbox' | 'vaapi' | 'v4l2m2m' | 'rkmpp' | 'omx' | 'none';
  preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
  crf: number;
  resolution: string; // 'original' or 'WIDTHxHEIGHT'
}

export interface SubtitleConfig {
  primary: TrackStyle;
  secondary: TrackStyle;
  ffmpeg: FFmpegConfig;
  primaryLanguage?: string;
  secondaryLanguage?: string;
  geminiFileUri?: string | null;
  geminiFileExpiration?: string | null;
  fileId?: string | null;
  originalFilename?: string | null;
}

export const DEFAULT_CONFIG: SubtitleConfig = {
  primaryLanguage: 'English',
  secondaryLanguage: 'Secondary',
  primary: {
    alignment: 2, // Bottom Center (ASS numpad)
    fontSize: 2.22, // ~24px at 1080p (24/1080*100)
    color: '#ffffff',
    fontFamily: 'Arial',
    marginV: 2.78, // ~30px at 1080p
    marginH: 1.04, // ~20px at 1920p width
    backgroundColor: 'rgba(0,0,0,0.7)',
    outlineColor: '#000000',
    outlineWidth: 0.19, // ~2px at 1080p
    shadowDistance: 0.09, // ~1px at 1080p
  },
  secondary: {
    alignment: 8, // Top Center (ASS numpad)
    fontSize: 1.85, // ~20px at 1080p
    color: '#fbbf24', // Amber-400
    fontFamily: 'Arial',
    marginV: 2.78, // ~30px at 1080p
    marginH: 1.04, // ~20px at 1920p width
    backgroundColor: 'rgba(0,0,0,0.7)',
    outlineColor: '#000000',
    outlineWidth: 0.19, // ~2px at 1080p
    shadowDistance: 0.09, // ~1px at 1080p
  },
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
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  defaultPrimaryStyle: {
    alignment: 2, // Bottom Center
    fontSize: 2.22,
    color: '#ffffff',
    fontFamily: 'Arial',
    marginV: 2.78,
    marginH: 1.04,
    backgroundColor: 'rgba(0,0,0,0.7)',
    outlineColor: '#000000',
    outlineWidth: 0.19,
    shadowDistance: 0.09,
  },
  defaultSecondaryStyle: {
    alignment: 8, // Top Center
    fontSize: 1.85,
    color: '#fbbf24',
    fontFamily: 'Arial',
    marginV: 2.78,
    marginH: 1.04,
    backgroundColor: 'rgba(0,0,0,0.7)',
    outlineColor: '#000000',
    outlineWidth: 0.19,
    shadowDistance: 0.09,
  },
  defaultPrimaryLanguage: 'English',
  defaultSecondaryLanguage: 'Simplified Chinese',
  subtitleStyle: 'split',
  defaultHwaccel: 'none',
  defaultPreset: 'veryfast',
  defaultCrf: 23,
  defaultGeminiModel: 'gemini-2.0-flash',
};