export interface SubtitleLine {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
  secondaryText?: string;
}

export interface SubtitleConfig {
  alignment: 'left' | 'center' | 'right';
  fontSize: number;
  color: string;
  fontFamily: string;
  marginW: number;
  marginH: number;
  backgroundColor: string;
}
