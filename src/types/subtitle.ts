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
  /** Font size: Number = 1080p Pixels, String = Percentage (e.g. "5%") */
  fontSize: number | string;
  color: string; // Hex format #RRGGBB
  fontFamily: string;
  /** Vertical margin: Number = 1080p Pixels, String = Percentage (e.g. "22.5%") */
  marginV: number | string;
  /** Horizontal margin: Number = 1080p Pixels, String = Percentage (e.g. "4%") */
  marginH: number | string;
  backgroundColor: string; // rgba() format for transparency
  outlineColor?: string; // Optional outline color
  /** Outline: Number = 1080p Pixels, String = Percentage */
  outlineWidth?: number | string;
  /** Shadow: Number = 1080p Pixels, String = Percentage */
  shadowDistance?: number | string;
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
    fontSize: "5%",       // responsive default
    color: '#ffffff',
    fontFamily: 'Arial',
    marginV: "22.5%",     // responsive default
    marginH: "4%",        // responsive default
    backgroundColor: 'rgba(0,0,0,0.7)',
    outlineColor: '#000000',
    outlineWidth: "0.2%",
    shadowDistance: "0.1%",
  },
  defaultSecondaryStyle: {
    alignment: 8, // Top Center
    fontSize: "4%",
    color: '#fbbf24',
    fontFamily: 'Arial',
    marginV: "22.5%",
    marginH: "4%",
    backgroundColor: 'rgba(0,0,0,0.7)',
    outlineColor: '#000000',
    outlineWidth: "0.2%",
    shadowDistance: "0.1%",
  },
  defaultPrimaryLanguage: 'English',
  defaultSecondaryLanguage: 'Simplified Chinese',
  subtitleStyle: 'split',
  defaultHwaccel: 'none',
  defaultPreset: 'veryfast',
  defaultCrf: 23,
  defaultGeminiModel: 'gemini-2.0-flash',
};