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
    const { fontFamily, fontSize, color, backgroundColor, marginV, marginH, outlineWidth, shadowDistance } = style;
    
    // ASS uses a different color format &HBBGGRR.
    const primaryColour = hexToAssColor(color);
    const backColour = hexToAssColor(backgroundColor);
    
    // Convert percentage values to absolute pixels for ASS (based on script resolution)
    const assFontSize = Math.round((fontSize / 100) * playResY);
    const assMarginV = Math.round((marginV / 100) * playResY);
    const assMarginH = Math.round((marginH / 100) * playResX);
    const assOutlineWidth = (outlineWidth ?? 0.19) / 100 * playResY;
    const assShadowDistance = (shadowDistance ?? 0.09) / 100 * playResY;

    // Alignment is numpad based, which is what ASS uses.
    const alignment = style.alignment;

    return `Style: ${name},${fontFamily},${assFontSize},${primaryColour},&H00FFFFFF,&H00000000,${backColour},0,0,0,0,100,100,0,0,1,${assOutlineWidth.toFixed(1)},${assShadowDistance.toFixed(1)},${alignment},${assMarginH},${assMarginH},${assMarginV},1`;
}

// Sanitize text to prevent ASS tag injection
function sanitizeAssText(text: string): string {
    return text.replace(/\{.*\}/g, ''); // Strip out any {style-tags}
}

export function generateAss(subtitles: SubtitleLine[], config: SubtitleConfig): string {
    const playResX = 1920;
    const playResY = 1080;
    
    const scriptInfo = [
        '[Script Info]',
        'Title: SubtitleGem Export',
        'ScriptType: v4.00+',
        `PlayResX: ${playResX}`,
        `PlayResY: ${playResY}`,
        'WrapStyle: 0',
        'ScaledBorderAndShadow: yes',
        '',
    ].join('\n');
    
    const styles = [
        '[V4+ Styles]',
        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
        generateStyleLine('Primary', config.primary, playResX, playResY),
        generateStyleLine('Secondary', config.secondary, playResX, playResY),
        '',
    ].join('\n');

    const events = [
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        ...subtitles.map(sub => {
            const colorTag = sub.primaryColor ? `{\\c${hexToAssColor(sub.primaryColor)}}` : '';
            return `Dialogue: 0,${formatAssTime(sub.startTime)},${formatAssTime(sub.endTime)},Primary,,0,0,0,,${colorTag}${sanitizeAssText(sub.text)}`;
        }),
        ...subtitles
            .filter(sub => sub.secondaryText)
            .map(sub => {
                const colorTag = sub.secondaryColor ? `{\\c${hexToAssColor(sub.secondaryColor)}}` : '';
                return `Dialogue: 0,${formatAssTime(sub.startTime)},${formatAssTime(sub.endTime)},Secondary,,0,0,0,,${colorTag}${sanitizeAssText(sub.secondaryText!)}`;
            }),
    ].join('\n');
    
    return `${scriptInfo}${styles}${events}`;
}
