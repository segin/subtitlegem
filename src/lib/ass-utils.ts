import { SubtitleLine, SubtitleConfig, TrackStyle, DEFAULT_GLOBAL_SETTINGS } from "@/types/subtitle";
import { formatSRTTime } from "./srt-utils";
import { resolveTrackStyle, normalizeToPx } from "./style-resolver";

// Convert hex color (#RRGGBB) to BGR for ASS format (&HBBGGRR)
export function hexToAssColor(hex: string | undefined): string {
    if (!hex) return '&HFFFFFF&'; // Default to white if undefined
    if (hex.startsWith('#')) {
        const r = hex.substring(1, 3);
        const g = hex.substring(3, 5);
        const b = hex.substring(5, 7);
        return `&H${b}${g}${r}&`;
    }
    return '&HFFFFFF&'; // Default to white
}

export function formatAssTime(seconds: number): string {
    const date = new Date(0);
    date.setMilliseconds(seconds * 1000);
    const h = date.getUTCHours().toString();
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    const cs = Math.floor(date.getUTCMilliseconds() / 10).toString().padStart(2, '0'); // Centiseconds
    return `${h}:${mm}:${ss}.${cs}`;
}

function generateStyleLine(name: string, style: TrackStyle, playResX: number = 1920, playResY: number = 1080): string {
    const { fontFamily, fontSize, color, backgroundColor, marginV, marginH, outlineWidth } = style;
    
    // Normalize all mixed units (pixels vs %) to Absolute ASS Pixels (based on PlayRes)
    const assFontSize = Math.round(normalizeToPx(fontSize, playResY));
    const assMarginV = Math.round(normalizeToPx(marginV, playResY));
    const assMarginH = Math.round(normalizeToPx(marginH, playResX));
    // Clamp outline to prevent massive globs
    const assOutlineWidth = Math.min(normalizeToPx(outlineWidth ?? 2.0, playResY), 20); 

    const primaryColour = hexToAssColor(color);
    const backColour = hexToAssColor(backgroundColor);
    
    // Fallback for Arial on Linux systems to Noto Sans (Better CJK support)
    const finalFontFamily = (fontFamily === 'Arial') ? 'Noto Sans' : fontFamily;

    // Alignment is numpad based
    const alignment = style.alignment;

    return `Style: ${name},${finalFontFamily},${assFontSize},${primaryColour},&H00FFFFFF,&H00000000,${backColour},0,0,0,0,100,100,0,0,1,${assOutlineWidth.toFixed(1)},0,${alignment},${assMarginH},${assMarginH},${assMarginV},1`;

}

// Sanitize text to prevent ASS tag injection
export function sanitizeAssText(text: string): string {
    // 1. Replace newlines with ASS line break \N
    // 2. Strip standard ASS tags {...}
    return text.replace(/\r?\n/g, '\\N').replace(/\{[^}]*\}/g, '');
}

export interface VideoDimensions {
    width: number;
    height: number;
}

export function generateAss(
    subtitles: SubtitleLine[], 
    config: SubtitleConfig, 
    videoDimensions?: VideoDimensions
): string {
    // Use actual video dimensions if provided, otherwise default to 1080p
    const playResX = videoDimensions?.width || 1920;
    const playResY = videoDimensions?.height || 1080;
    
    // Resolve styles with inheritance (Global -> Project -> Line)
    const resolvedPrimary = resolveTrackStyle(
        DEFAULT_GLOBAL_SETTINGS.defaultPrimaryStyle,
        config.primary
    );
    const resolvedSecondary = resolveTrackStyle(
        DEFAULT_GLOBAL_SETTINGS.defaultSecondaryStyle,
        config.secondary
    );
    
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
        generateStyleLine('Primary', resolvedPrimary, playResX, playResY),
        generateStyleLine('Secondary', resolvedSecondary, playResX, playResY),
        '',
    ].join('\n');

    const events = [
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        ...subtitles.map(sub => {
            // For per-line overrides, resolve style: Global -> Project -> Line
            const lineStyle = resolveTrackStyle(
                DEFAULT_GLOBAL_SETTINGS.defaultPrimaryStyle,
                config.primary,
                sub.styleOverrides
            );
            
            // If line has custom color, use it; otherwise use resolved style
            const customColor = sub.styleOverrides?.color || sub.primaryColor;
            const colorTag = customColor ? `{\\c${hexToAssColor(customColor)}}` : '';
            
            return `Dialogue: 0,${formatAssTime(sub.startTime)},${formatAssTime(sub.endTime)},Primary,,0,0,0,,${colorTag}${sanitizeAssText(sub.text)}`;
        }),
        ...subtitles
            .filter(sub => sub.secondaryText)
            .map(sub => {
                const customColor = sub.secondaryColor;
                const colorTag = customColor ? `{\\c${hexToAssColor(customColor)}}` : '';
                return `Dialogue: 0,${formatAssTime(sub.startTime)},${formatAssTime(sub.endTime)},Secondary,,0,0,0,,${colorTag}${sanitizeAssText(sub.secondaryText!)}`;
            }),
    ].join('\n');
    
    return `${scriptInfo}${styles}${events}`;
}
