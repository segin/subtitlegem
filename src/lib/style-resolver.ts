import { TrackStyle, GlobalSettings, SubtitleConfig } from "@/types/subtitle";
import { REFERENCE_WIDTH, REFERENCE_HEIGHT } from "@/types/constants";

/**
 * Resolves the final style for a subtitle line by merging:
 * 1. Global Defaults (Bottom)
 * 2. Project Overrides (Middle)
 * 3. Line Overrides (Top)
 */
export function resolveTrackStyle(
  baseStyle: TrackStyle,
  projectOverride?: Partial<TrackStyle>,
  lineOverride?: Partial<TrackStyle>
): TrackStyle {
  return {
    ...baseStyle,
    ...(projectOverride || {}),
    ...(lineOverride || {}),
  } as TrackStyle; // Casting because we assume baseStyle covers all required fields
}

/**
 * Calculates CSS style object for previewing a TrackStyle
 */
// Helper to normalize any TrackStyle numeric/string field to 1080p Reference Pixels
export function normalizeToPx(value: number | string | undefined, fullSize: number): number {
    if (value === undefined) return 0;
    if (typeof value === 'number') return value; // Already Pixels
    
    // Parse percentage string "50%" -> 50
    const percent = parseFloat(value);
    if (isNaN(percent)) return 0;
    
    // Return pixels relative to fullSize
    return (percent / 100) * fullSize;
}

/**
 * Calculates CSS style object for previewing a TrackStyle
 */
export function getPreviewStyle(style: TrackStyle, videoHeightPx: number = 360) {
    // 1. Resolve everything to 1080p Reference Pixels first
    const refFontSize = normalizeToPx(style.fontSize, REFERENCE_HEIGHT);
    const refOutline = normalizeToPx(style.outlineWidth ?? 2.0, REFERENCE_HEIGHT);
    
    // Margins - strictly speaking MarginH should be relative to width (1920) if %, 
    // but users might expect height-relative sizing for margins too? 
    // Standard is MarginH % of Width, MarginV % of Height.
    // However, if we store pixels, they are just pixels.
    // Let's stick to standard behavior: H is % of Width (REFERENCE_WIDTH).
    // ...actually for preview CSS, we can pass raw % string if it is %, or px string if px.
    // BUT we need to scale "1080p pixels" to "360p pixels" for preview.
    
    // Scale from 1080p ref to preview height
    const scale = videoHeightPx / REFERENCE_HEIGHT;
    
    const fontSizePx = refFontSize * scale;
    const outlinePx = refOutline * scale;
    
    return {
        fontFamily: style.fontFamily,
        fontSize: `${fontSizePx}px`,
        color: style.color,
        backgroundColor: style.backgroundColor,
        textShadow: outlinePx 
          ? `0 0 ${outlinePx}px ${style.outlineColor || '#000'}` 
          : 'none',
        boxShadow: 'none', 
    };
}

/**
 * Calculates CSS margin/padding style for preview containers based on alignment.
 * Reusable across GlobalSettingsDialog and ProjectSettingsDialog.
 */
export function getMarginPreviewStyle(
    marginV: number | string,
    marginH: number | string,
    alignment: number
): React.CSSProperties {
    // Convert to percentage strings if they're numbers (reference pixel values)
    const vPct = typeof marginV === 'string' ? marginV : `${(marginV / REFERENCE_HEIGHT) * 100}%`;
    const hPct = typeof marginH === 'string' ? marginH : `${(marginH / REFERENCE_WIDTH) * 100}%`;

    return {
        paddingTop: alignment >= 7 ? vPct : 0,
        paddingBottom: alignment <= 3 ? vPct : 0,
        paddingLeft: hPct,
        paddingRight: hPct,
        display: 'flex',
        flexDirection: 'column',
        alignItems: [1, 4, 7].includes(alignment) ? 'flex-start' :
                    [3, 6, 9].includes(alignment) ? 'flex-end' : 'center',
        justifyContent: [7, 8, 9].includes(alignment) ? 'flex-start' :
                        [1, 2, 3].includes(alignment) ? 'flex-end' : 'center',
    };
}
