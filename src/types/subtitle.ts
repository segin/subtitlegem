export interface SubtitleLine {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
  secondaryText?: string;
}

export type Alignment = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface TrackStyle {
  alignment: Alignment;
  fontSize: number;
  color: string;
  fontFamily: string;
  marginV: number; // Vertical margin
  marginH: number; // Horizontal margin
  backgroundColor: string;
}

export interface SubtitleConfig {
  primary: TrackStyle;
  secondary: TrackStyle;
}

export const DEFAULT_CONFIG: SubtitleConfig = {
  primary: {
    alignment: 2, // Bottom Center
    fontSize: 24,
    color: '#ffffff',
    fontFamily: 'Inter, sans-serif',
    marginV: 30,
    marginH: 20,
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  secondary: {
    alignment: 8, // Top Center
    fontSize: 18,
    color: '#fbbf24', // Amber-400
    fontFamily: 'Inter, sans-serif',
    marginV: 30,
    marginH: 20,
    backgroundColor: 'rgba(0,0,0,0.5)'
  }
};