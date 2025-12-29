import { TrackStyle, GlobalSettings, SubtitleConfig } from "@/types/subtitle";

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
    const refFontSize = normalizeToPx(style.fontSize, 1080);
    const refOutline = normalizeToPx(style.outlineWidth ?? 2.0, 1080);
    const refShadow = normalizeToPx(style.shadowDistance ?? 1.5, 1080);
    // Margins - strictly speaking MarginH should be relative to width (1920) if %, 
    // but users might expect height-relative sizing for margins too? 
    // Standard is MarginH % of Width, MarginV % of Height.
    // However, if we store pixels, they are just pixels.
    // Let's stick to standard behavior: H is % of Width (1920).
    // ...actually for preview CSS, we can pass raw % string if it is %, or px string if px.
    // BUT we need to scale "1080p pixels" to "360p pixels" for preview.
    
    // Scale from 1080p ref to preview height
    const scale = videoHeightPx / 1080;
    
    const fontSizePx = refFontSize * scale;
    const outlinePx = refOutline * scale;
    const shadowPx = refShadow * scale;
    
    return {
        fontFamily: style.fontFamily,
        fontSize: `${fontSizePx}px`,
        color: style.color,
        backgroundColor: style.backgroundColor,
        textShadow: outlinePx 
          ? `0 0 ${outlinePx}px ${style.outlineColor || '#000'}` 
          : 'none',
        boxShadow: shadowPx
          ? `${shadowPx}px ${shadowPx}px 0px rgba(0,0,0,0.5)`
          : 'none',
    };
}
