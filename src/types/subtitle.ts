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
  fontSize: number;
  color: string; // Hex format #RRGGBB
  fontFamily: string;
  marginV: number; // Vertical margin in pixels
  marginH: number; // Horizontal margin in pixels
  backgroundColor: string; // rgba() format for transparency
  outlineColor?: string; // Optional outline color
  outlineWidth?: number; // Optional outline width
  shadowDistance?: number; // Optional shadow offset
}

export interface FFmpegConfig {
  hwaccel: 'nvenc' | 'qsv' | 'videotoolbox' | 'none';
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
}

export const DEFAULT_CONFIG: SubtitleConfig = {
  primaryLanguage: 'English',
  secondaryLanguage: 'Secondary',
  primary: {
    alignment: 2, // Bottom Center (ASS numpad)
    fontSize: 24,
    color: '#ffffff',
    fontFamily: 'Arial',
    marginV: 30,
    marginH: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    outlineColor: '#000000',
    outlineWidth: 2,
    shadowDistance: 1,
  },
  secondary: {
    alignment: 8, // Top Center (ASS numpad)
    fontSize: 20,
    color: '#fbbf24', // Amber-400
    fontFamily: 'Arial',
    marginV: 30,
    marginH: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    outlineColor: '#000000',
    outlineWidth: 2,
    shadowDistance: 1,
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