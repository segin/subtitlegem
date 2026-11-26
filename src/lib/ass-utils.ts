import { SubtitleLine, SubtitleConfig, TrackStyle } from "@/types/subtitle";
import { REFERENCE_WIDTH, REFERENCE_HEIGHT } from "@/types/constants";
import { toAssColour } from "./css-color";
import {
    assFontName,
    getTrackMetrics,
    GlobalStyleDefaults,
    isTrackShown,
    resolveProjectStyles,
} from "./subtitle-render-style";

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

/**
 * Sizes are stored as percentages of the video (see getTrackMetrics) and
 * PlayRes is the video's own size, so these are video pixels.
 *
 * With a background, BorderStyle 4 (libass 0.17+) draws one box around the
 * whole event in BackColour and still draws the outline in OutlineColour.
 * The box reaches Outline + Shadow pixels past the text, so Shadow sets the
 * padding (libass draws no separate drop shadow in this mode). Renderers
 * without BorderStyle 4 fall back to a plain outline.
 */
function generateStyleLine(name: string, style: TrackStyle, playResX: number, playResY: number): string {
    const m = getTrackMetrics(style, playResX, playResY);
    const hasBox = m.boxColor !== null;

    const fields = [
        name,
        assFontName(style.fontFamily),
        Math.round(m.fontSize),
        toAssColour(m.textColor),           // PrimaryColour
        '&H00FFFFFF',                       // SecondaryColour (karaoke only)
        toAssColour(m.outlineColor),        // OutlineColour
        hasBox ? toAssColour(m.boxColor!) : '&H00000000', // BackColour
        0, 0, 0, 0,                         // Bold, Italic, Underline, StrikeOut
        100, 100, 0, 0,                     // ScaleX, ScaleY, Spacing, Angle
        hasBox ? 4 : 1,                     // BorderStyle
        m.outline.toFixed(1),
        hasBox ? (m.boxPadding - m.outline).toFixed(1) : 0, // Shadow
        m.alignment,
        Math.round(m.marginH), Math.round(m.marginH), Math.round(m.marginV),
        1,                                  // Encoding
    ];
    return `Style: ${fields.join(',')}`;
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

/**
 * @param globalStyles Global Settings styles, which sit between the built-in
 *   defaults and the project's own overrides.
 */
export function generateAss(
    subtitles: SubtitleLine[],
    config: SubtitleConfig,
    videoDimensions?: VideoDimensions,
    globalStyles?: GlobalStyleDefaults | null,
): string {
    // Use actual video dimensions if provided, otherwise default to 1080p
    const playResX = videoDimensions?.width || REFERENCE_WIDTH;
    const playResY = videoDimensions?.height || REFERENCE_HEIGHT;

    // Built-in defaults -> Global Settings -> project overrides (lines add a colour below)
    const styles = resolveProjectStyles(config, globalStyles);
    const showPrimary = isTrackShown(config, 'primary', styles.primary);
    const showSecondary = isTrackShown(config, 'secondary', styles.secondary);

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

    const styleSection = [
        '[V4+ Styles]',
        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
        generateStyleLine('Primary', styles.primary, playResX, playResY),
        generateStyleLine('Secondary', styles.secondary, playResX, playResY),
        '',
    ].join('\n');

    // Notes like "[Subtitles missing ...]" are for the editor only, never burned in
    const exported = subtitles.filter(sub => !sub.placeholder);

    const events = [
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        ...(showPrimary ? exported : []).map(sub => {
            // If line has custom color, use it; otherwise use resolved style
            const customColor = sub.styleOverrides?.color || sub.primaryColor;
            const colorTag = customColor ? `{\\c${hexToAssColor(customColor)}}` : '';

            return `Dialogue: 0,${formatAssTime(sub.startTime)},${formatAssTime(sub.endTime)},Primary,,0,0,0,,${colorTag}${sanitizeAssText(sub.text)}`;
        }),
        ...(showSecondary ? exported : [])
            .filter(sub => sub.secondaryText)
            .map(sub => {
                const customColor = sub.secondaryColor;
                const colorTag = customColor ? `{\\c${hexToAssColor(customColor)}}` : '';
                return `Dialogue: 0,${formatAssTime(sub.startTime)},${formatAssTime(sub.endTime)},Secondary,,0,0,0,,${colorTag}${sanitizeAssText(sub.secondaryText!)}`;
            }),
    ].join('\n');

    return `${scriptInfo}${styleSection}${events}`;
}
