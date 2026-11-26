/**
 * How a subtitle track looks on the final video.
 *
 * The ASS export (burned in by libass) and the editor preview both work from
 * getTrackMetrics(), so the preview shows what the export will draw: the same
 * size, margins, outline, and background box.
 */
import type { CSSProperties } from "react";
import { Alignment, DEFAULT_GLOBAL_SETTINGS, GlobalSettings, SubtitleConfig, TrackStyle } from "@/types/subtitle";
import { REFERENCE_HEIGHT, REFERENCE_WIDTH } from "@/types/constants";
import { normalizeToPx } from "./style-resolver";
import { parseCssColor, RGBA, toCssColor } from "./css-color";

export type Track = 'primary' | 'secondary';

/** The style part of Global Settings; saved settings may be missing fields. */
export type GlobalStyleDefaults = {
  defaultPrimaryStyle?: Partial<TrackStyle>;
  defaultSecondaryStyle?: Partial<TrackStyle>;
} | Pick<GlobalSettings, 'defaultPrimaryStyle' | 'defaultSecondaryStyle'>;

/**
 * Font sizes are doubled when rendering: "If it says 5%, act like the user put
 * in 10% when doing the render." (an earlier user request)
 */
const FONT_SIZE_MULTIPLIER = 2;
/** Outline width cap, in video pixels, to prevent massive globs */
const MAX_OUTLINE_PX = 20;
/** Space around the text inside a background box, as a share of the line height */
const BOX_PADDING_RATIO = 0.1;
/** Arial isn't installed on most Linux servers; Noto Sans also has better CJK coverage */
const DEFAULT_FONT_NAME = 'Noto Sans';
const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);

/** Drops undefined/null so a cleared override ("Inherit") doesn't wipe the inherited value */
function definedOnly<T extends object>(style: Partial<T> | null | undefined): Partial<T> {
  if (!style) return {};
  return Object.fromEntries(Object.entries(style).filter(([, v]) => v !== undefined && v !== null)) as Partial<T>;
}

/** Built-in defaults ← Global Settings ← project overrides */
export function resolveProjectStyles(
  config: Pick<SubtitleConfig, 'primary' | 'secondary'>,
  globalStyles?: GlobalStyleDefaults | null,
): Record<Track, TrackStyle> {
  return {
    primary: {
      ...DEFAULT_GLOBAL_SETTINGS.defaultPrimaryStyle,
      ...definedOnly<TrackStyle>(globalStyles?.defaultPrimaryStyle),
      ...definedOnly<TrackStyle>(config.primary),
    },
    secondary: {
      ...DEFAULT_GLOBAL_SETTINGS.defaultSecondaryStyle,
      ...definedOnly<TrackStyle>(globalStyles?.defaultSecondaryStyle),
      ...definedOnly<TrackStyle>(config.secondary),
    },
  };
}

/**
 * Whether a track is drawn on the video: not switched off in Project Settings,
 * and not shrunk to font size 0 (the old way of hiding one).
 */
export function isTrackShown(
  config: Pick<SubtitleConfig, 'showPrimary' | 'showSecondary'>,
  track: Track,
  style: TrackStyle,
): boolean {
  const flag = track === 'primary' ? config.showPrimary : config.showSecondary;
  return flag !== false && normalizeToPx(style.fontSize, REFERENCE_HEIGHT) > 0;
}

const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, '').trim();

/** The single font name handed to libass. A CSS list like "Inter, sans-serif" would break the ASS style line. */
export function assFontName(fontFamily: string | undefined): string {
  const first = unquote((fontFamily || '').split(',')[0]);
  if (!first || first.toLowerCase() === 'arial') return DEFAULT_FONT_NAME;
  return first;
}

/** CSS font list for the preview: the font the export uses first, then what the user picked. */
export function previewFontFamily(fontFamily: string | undefined, exportFamily?: string): string {
  const names = [exportFamily, assFontName(fontFamily), ...(fontFamily || '').split(',').map(unquote), 'sans-serif']
    .filter((n): n is string => !!n);
  return [...new Set(names)].map(n => (GENERIC_FAMILIES.has(n) ? n : `"${n}"`)).join(', ');
}

export interface TrackMetrics {
  /** ASS Fontsize. libass sizes text so one line is exactly this tall (ascent + descent). */
  fontSize: number;
  /** Outline width; 0 for none */
  outline: number;
  /** Space between the text and the edge of the background box; 0 without a box */
  boxPadding: number;
  marginV: number;
  marginH: number;
  textColor: RGBA;
  outlineColor: RGBA;
  /** null when the background is empty, "none"/"transparent" or fully transparent */
  boxColor: RGBA | null;
  alignment: Alignment;
  /** As chosen by the user (may be a CSS list) */
  fontFamily: string;
}

/** Track geometry in pixels of a width × height video */
export function getTrackMetrics(style: TrackStyle, width: number, height: number): TrackMetrics {
  const scaleX = width / REFERENCE_WIDTH;
  const scaleY = height / REFERENCE_HEIGHT;

  const fontSize = normalizeToPx(style.fontSize, REFERENCE_HEIGHT) * scaleY * FONT_SIZE_MULTIPLIER;
  const outline = Math.min(normalizeToPx(style.outlineWidth ?? 0, REFERENCE_HEIGHT) * scaleY, MAX_OUTLINE_PX);
  const background = parseCssColor(style.backgroundColor);
  const boxColor = background && background.a > 0 ? background : null;

  return {
    fontSize,
    outline,
    // libass pads the box by at least the outline width
    boxPadding: boxColor ? Math.max(outline, fontSize * BOX_PADDING_RATIO) : 0,
    marginV: normalizeToPx(style.marginV, REFERENCE_HEIGHT) * scaleY,
    marginH: normalizeToPx(style.marginH, REFERENCE_WIDTH) * scaleX,
    textColor: parseCssColor(style.color) ?? { r: 255, g: 255, b: 255, a: 1 },
    outlineColor: parseCssColor(style.outlineColor) ?? { r: 0, g: 0, b: 0, a: 1 },
    boxColor,
    alignment: style.alignment,
    fontFamily: style.fontFamily,
  };
}

/** The same metrics on a preview that is `factor` times the video's size */
export function scaleTrackMetrics(m: TrackMetrics, factor: number): TrackMetrics {
  return {
    ...m,
    fontSize: m.fontSize * factor,
    outline: m.outline * factor,
    boxPadding: m.boxPadding * factor,
    marginV: m.marginV * factor,
    marginH: m.marginH * factor,
  };
}

type Edge = 'start' | 'center' | 'end';
const horizontalEdge = (a: Alignment): Edge => ([1, 4, 7].includes(a) ? 'start' : [3, 6, 9].includes(a) ? 'end' : 'center');
const verticalEdge = (a: Alignment): Edge => ([7, 8, 9].includes(a) ? 'start' : [1, 2, 3].includes(a) ? 'end' : 'center');
const flexValue = (e: Edge) => (e === 'start' ? 'flex-start' : e === 'end' ? 'flex-end' : 'center');

/**
 * CSS for drawing one track over a preview, laid out the way libass lays it out.
 * `font` is what the server will draw this track's font with (/api/font-metrics).
 */
export function getTrackPreviewCss(
  m: TrackMetrics,
  font: ExportFontMetrics = DEFAULT_EXPORT_FONT,
): { wrapper: CSSProperties; text: CSSProperties } {
  const h = horizontalEdge(m.alignment);
  const wrapper: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    justifyContent: flexValue(h),
    alignItems: flexValue(verticalEdge(m.alignment)),
    padding: `${m.marginV}px ${m.marginH}px`,
    boxSizing: 'border-box',
    pointerEvents: 'none',
  };

  const text: CSSProperties = {
    boxSizing: 'content-box',
    maxWidth: '100%',
    // The server's actual font first (e.g. Noto Sans standing in for Georgia), if this browser has it
    fontFamily: previewFontFamily(m.fontFamily, font.family),
    // Same em size as libass: one line is Fontsize tall
    fontSize: `${m.fontSize / font.lineRatio}px`,
    lineHeight: `${m.fontSize}px`,
    color: toCssColor(m.textColor),
    textAlign: h === 'start' ? 'left' : h === 'end' ? 'right' : 'center',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    textWrap: 'balance',
  };
  if (m.boxColor) {
    // libass grows the box outward from the text, so the text keeps its place
    Object.assign(text, {
      backgroundColor: toCssColor(m.boxColor),
      padding: `${m.boxPadding}px`,
      margin: `${-m.boxPadding}px`,
    });
  }
  if (m.outline > 0) {
    // The stroke is centred on the glyph edge; painting it under the fill leaves `outline` px outside
    Object.assign(text, {
      WebkitTextStroke: `${m.outline * 2}px ${toCssColor(m.outlineColor)}`,
      paintOrder: 'stroke fill',
    });
  }
  return { wrapper, text };
}

/** The font the export server really draws a family with (fontconfig may substitute) */
export interface ExportFontMetrics {
  family: string;
  /**
   * Line height ÷ em size as libass measures it (OS/2 win ascent + descent).
   * libass makes one line exactly Fontsize tall; browsers size by the em.
   */
  lineRatio: number;
}

/** Noto Sans: (usWinAscent 1124 + usWinDescent 395) / 1000 units per em */
export const DEFAULT_EXPORT_FONT: ExportFontMetrics = { family: DEFAULT_FONT_NAME, lineRatio: 1.519 };
