import { SubtitleLine } from "@/types/subtitle";
import { v4 as uuidv4 } from "uuid";

export const formatSRTTime = (seconds: number): string => {
  const date = new Date(0);
  date.setMilliseconds(seconds * 1000);
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  const ss = date.getUTCSeconds().toString().padStart(2, '0');
  const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
};

export const parseSRTTime = (timeStr: string): number => {
  if (!timeStr) return 0;
  
  // Normalize separators: replace dot with comma for standard processing if needed, 
  // but actually we just split by non-digits usually.
  // Let's handle HH:MM:SS,mmm AND MM:SS,mmm AND HH:MM:SS.mmm
  
  const parts = timeStr.trim().split(/[:,.]/);
  
  // parts could be [HH, MM, SS, mmm] or [MM, SS, mmm]
  
  let h = 0, m = 0, s = 0, ms = 0;
  
  if (parts.length === 4) {
    [h, m, s, ms] = parts.map(Number);
  } else if (parts.length === 3) {
    [m, s, ms] = parts.map(Number);
  } else {
    // Fallback or error
    return 0;
  }
  
  return h * 3600 + m * 60 + s + (ms || 0) / 1000;
};

export function stringifySRT(subtitles: SubtitleLine[], type: 'primary' | 'secondary'): string {
  return subtitles
    .filter(sub => type === 'primary' ? !!sub.text : !!sub.secondaryText)
    .map((sub, index) => {
      const text = type === 'primary' ? sub.text : sub.secondaryText;
      return `${index + 1}\n${formatSRTTime(sub.startTime)} --> ${formatSRTTime(sub.endTime)}\n${text}\n`;
    })
    .join('\n');
}

export function parseSRT(srtContent: string): Partial<SubtitleLine>[] {
  const normalized = srtContent.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  
  const parsed: Partial<SubtitleLine>[] = [];
  
  blocks.forEach(block => {
    const lines = block.trim().split('\n');
    if (lines.length >= 3) {
      // Line 1: Index (ignored)
      // Line 2: Time
      const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
      if (timeMatch) {
        const startTime = parseSRTTime(timeMatch[1]);
        const endTime = parseSRTTime(timeMatch[2]);
        const text = lines.slice(2).join('\n');
        
        parsed.push({
          startTime,
          endTime,
          text // This will be mapped to 'text' or 'secondaryText' by the caller
        });
      }
    }
  });
  
  return parsed;
}
