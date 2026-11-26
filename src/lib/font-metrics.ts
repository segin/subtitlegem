/**
 * Which font libass will really draw a subtitle family with, and how big.
 *
 * Server-only (runs fc-match and reads font files). The editor preview asks
 * for this through /api/font-metrics so it can draw text the size the export
 * will: libass sizes a font so one line (OS/2 usWinAscent + usWinDescent) is
 * the ASS Fontsize, while browsers size by the em. For Noto Sans the two
 * differ by 1.519x.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import { DEFAULT_EXPORT_FONT, ExportFontMetrics } from "./subtitle-render-style";

const execFileAsync = promisify(execFile);

/** Plain family names only: fontconfig gives ':', '-' and ',' special meaning */
export function isSafeFontFamily(family: string): boolean {
  return /^[\p{L}\p{N} _.']{1,100}$/u.test(family);
}

/**
 * Line height ÷ em size, as libass computes it: OS/2 win ascent + descent,
 * then typo ascender - descender, then hhea. Handles .ttf, .otf and .ttc.
 */
export async function readFontLineRatio(file: string, index = 0): Promise<number | null> {
  const fh = await fs.promises.open(file, "r");
  try {
    const read = async (position: number, length: number) => {
      const buf = Buffer.alloc(length);
      const { bytesRead } = await fh.read(buf, 0, length, position);
      if (bytesRead < length) throw new Error("font file is truncated");
      return buf;
    };

    let base = 0;
    if ((await read(0, 4)).toString("latin1") === "ttcf") {
      const numFonts = (await read(8, 4)).readUInt32BE(0);
      base = (await read(12 + 4 * (index < numFonts ? index : 0), 4)).readUInt32BE(0);
    }

    const numTables = (await read(base + 4, 2)).readUInt16BE(0);
    const dir = await read(base + 12, numTables * 16);
    const tables = new Map<string, number>();
    for (let i = 0; i < numTables; i++) {
      tables.set(dir.toString("latin1", i * 16, i * 16 + 4), dir.readUInt32BE(i * 16 + 8));
    }

    const head = tables.get("head");
    if (head === undefined) return null;
    const unitsPerEm = (await read(head + 18, 2)).readUInt16BE(0);
    if (!unitsPerEm) return null;

    const os2 = tables.get("OS/2");
    if (os2 !== undefined) {
      const m = await read(os2 + 68, 10); // sTypoAscender .. usWinDescent
      const win = m.readInt16BE(6) + m.readInt16BE(8); // libass reads these as signed
      if (win > 0) return win / unitsPerEm;
      const typo = m.readInt16BE(0) - m.readInt16BE(2);
      if (typo > 0) return typo / unitsPerEm;
    }
    const hhea = tables.get("hhea");
    if (hhea !== undefined) {
      const m = await read(hhea + 4, 4);
      const height = m.readInt16BE(0) - m.readInt16BE(2);
      if (height > 0) return height / unitsPerEm;
    }
    return null;
  } finally {
    await fh.close();
  }
}

const cache = new Map<string, Promise<ExportFontMetrics>>();

async function lookUp(family: string): Promise<ExportFontMetrics> {
  try {
    const { stdout } = await execFileAsync("fc-match", ["-f", "%{family[0]}\n%{file}\n%{index}", family], { timeout: 5000 });
    const [matched, file, index] = stdout.split("\n");
    if (!matched || !file) return DEFAULT_EXPORT_FONT;
    const lineRatio = await readFontLineRatio(file, Number(index) || 0);
    return lineRatio ? { family: matched, lineRatio } : DEFAULT_EXPORT_FONT;
  } catch (error) {
    console.warn(`[Fonts] Could not look up "${family}"; previews assume Noto Sans:`, error instanceof Error ? error.message : error);
    return DEFAULT_EXPORT_FONT;
  }
}

/** The font fontconfig (and so libass) picks for a family, with its line ratio. Cached per family. */
export function getExportFontMetrics(family: string): Promise<ExportFontMetrics> {
  if (!isSafeFontFamily(family)) return Promise.resolve(DEFAULT_EXPORT_FONT);
  let pending = cache.get(family);
  if (!pending) {
    pending = lookUp(family);
    cache.set(family, pending);
  }
  return pending;
}
