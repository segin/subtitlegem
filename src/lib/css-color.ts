/**
 * Minimal CSS colour handling for subtitle styles, shared by the ASS export
 * (server and browser) and the editor preview.
 */

export interface RGBA {
  r: number; // 0-255
  g: number;
  b: number;
  a: number; // 0 (transparent) - 1 (opaque)
}

const NAMED: Record<string, RGBA> = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  none: { r: 0, g: 0, b: 0, a: 0 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function parseChannel(part: string): number | null {
  const n = parseFloat(part);
  if (isNaN(n)) return null;
  return Math.round(clamp(part.endsWith('%') ? (n / 100) * 255 : n, 0, 255));
}

function parseAlpha(part: string | undefined): number | null {
  if (part === undefined) return 1;
  const n = parseFloat(part);
  if (isNaN(n)) return null;
  return clamp(part.endsWith('%') ? n / 100 : n, 0, 1);
}

/**
 * Parses #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() (comma or space
 * separated), "transparent", "none", "black" and "white".
 * Returns null for anything else (including empty values).
 */
export function parseCssColor(value: string | null | undefined): RGBA | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (NAMED[v]) return { ...NAMED[v] };

  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v);
  if (hex) {
    let digits = hex[1];
    if (digits.length <= 4) digits = digits.split('').map(d => d + d).join('');
    const byte = (i: number) => parseInt(digits.slice(i, i + 2), 16);
    return { r: byte(0), g: byte(2), b: byte(4), a: digits.length === 8 ? byte(6) / 255 : 1 };
  }

  const fn = /^rgba?\(([^)]*)\)$/.exec(v);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length !== 3 && parts.length !== 4) return null;
    const [r, g, b] = parts.slice(0, 3).map(parseChannel);
    const a = parseAlpha(parts[3]);
    if (r === null || g === null || b === null || a === null) return null;
    return { r, g, b, a };
  }

  return null;
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();

/** ASS style colour, &HAABBGGRR, where AA is transparency (00 = opaque). */
export function toAssColour(color: RGBA): string {
  return `&H${hex2((1 - color.a) * 255)}${hex2(color.b)}${hex2(color.g)}${hex2(color.r)}`;
}

/** CSS rgba() string, for the preview. */
export function toCssColor(color: RGBA): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.round(color.a * 1000) / 1000})`;
}

/** #rrggbb, for <input type="color">. */
export function toHexColor(color: RGBA): string {
  return `#${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`.toLowerCase();
}
