// src/lib/ass-utils.ts
import { SubtitleLine, SubtitleConfig, TrackStyle } from "@/types/subtitle";
import { formatSRTTime } from "./srt-utils";

function formatAssTime(seconds: number): string {
    const date = new Date(0);
    date.setMilliseconds(seconds * 1000);
    const h = date.getUTCHours().toString();
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    const cs = Math.floor(date.getUTCMilliseconds() / 10).toString().padStart(2, '0'); // Centiseconds
    return `${h}:${mm}:${ss}.${cs}`;
}

// Convert hex color (#RRGGBB) to BGR for ASS format (&HBBGGRR)
function hexToAssColor(hex: string): string {
    if (hex.startsWith('#')) {
        const r = hex.substring(1, 3);
        const g = hex.substring(3, 5);
        const b = hex.substring(5, 7);
        return `&H${b}${g}${r}&`;
    }
    return '&HFFFFFF&'; // Default to white
}

function generateStyleLine(name: string, style: TrackStyle, playResX: number = 1920, playResY: number = 1080): string {
    const { fontFamily, fontSize, color, backgroundColor, marginV, marginH } = style;
    
    // ASS uses a different color format &HBBGGRR.
    const primaryColour = hexToAssColor(color);
    const backColour = hexToAssColor(backgroundColor);
    
    // ASS font size is relative to script resolution. This is a simplification.
    const assFontSize = (fontSize / playResY) * 1080;

    // Alignment is numpad based, which is what ASS uses.
    const alignment = style.alignment;

    return `Style: ${name},${fontFamily},${assFontSize},${primaryColour},&H00FFFFFF,&H00000000,${backColour},0,0,0,0,100,100,0,0,1,1,1,${alignment},${marginH},${marginH},${marginV},1`;
}

// Sanitize text to prevent ASS tag injection
function sanitizeAssText(text: string): string {
    return text.replace(/\{.*\}/g, ''); // Strip out any {style-tags}
}

export function generateAss(subtitles: SubtitleLine[], config: SubtitleConfig): string {
    const playResX = 1920;
    const playResY = 1080;
// ...
    const events = [
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        ...subtitles.map(sub => `Dialogue: 0,${formatAssTime(sub.startTime)},${formatAssTime(sub.endTime)},Primary,,0,0,0,,${sanitizeAssText(sub.text)}`),
        ...subtitles
            .filter(sub => sub.secondaryText)
            .map(sub => `Dialogue: 0,${formatAssTime(sub.startTime)},${formatAssTime(sub.endTime)},Secondary,,0,0,0,,${sanitizeAssText(sub.secondaryText!)}`),
    ].join('\n');
    
    return `${scriptInfo}${styles}${events}`;
}
