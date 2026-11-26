/**
 * @jest-environment node
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getExportFontMetrics, isSafeFontFamily, readFontLineRatio } from './font-metrics';
import { DEFAULT_EXPORT_FONT } from './subtitle-render-style';

/** A minimal sfnt with just the tables readFontLineRatio looks at */
function sfnt(opts: { upm: number; win?: [number, number]; typo?: [number, number]; hhea?: [number, number] }): Buffer {
  const tables: [string, Buffer][] = [];
  const head = Buffer.alloc(54);
  head.writeUInt16BE(opts.upm, 18);
  tables.push(['head', head]);
  if (opts.hhea) {
    const hhea = Buffer.alloc(36);
    hhea.writeInt16BE(opts.hhea[0], 4);
    hhea.writeInt16BE(opts.hhea[1], 6);
    tables.push(['hhea', hhea]);
  }
  if (opts.win || opts.typo) {
    const os2 = Buffer.alloc(96);
    os2.writeInt16BE(opts.typo?.[0] ?? 0, 68);
    os2.writeInt16BE(opts.typo?.[1] ?? 0, 70);
    os2.writeUInt16BE(opts.win?.[0] ?? 0, 74);
    os2.writeUInt16BE(opts.win?.[1] ?? 0, 76);
    tables.push(['OS/2', os2]);
  }
  const header = Buffer.alloc(12 + 16 * tables.length);
  header.writeUInt32BE(0x00010000, 0);
  header.writeUInt16BE(tables.length, 4);
  let offset = header.length;
  tables.forEach(([tag, data], i) => {
    header.write(tag, 12 + 16 * i, 'latin1');
    header.writeUInt32BE(offset, 12 + 16 * i + 8);
    header.writeUInt32BE(data.length, 12 + 16 * i + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...tables.map(([, data]) => data)]);
}

/** Wraps fonts in a .ttc collection, rebasing their table offsets */
function ttc(fonts: Buffer[]): Buffer {
  const header = Buffer.alloc(12 + 4 * fonts.length);
  header.write('ttcf', 0, 'latin1');
  header.writeUInt32BE(0x00010000, 4);
  header.writeUInt32BE(fonts.length, 8);
  let offset = header.length;
  const rebased = fonts.map((font, i) => {
    header.writeUInt32BE(offset, 12 + 4 * i);
    const copy = Buffer.from(font);
    const numTables = copy.readUInt16BE(4);
    for (let t = 0; t < numTables; t++) {
      const at = 12 + 16 * t + 8;
      copy.writeUInt32BE(copy.readUInt32BE(at) + offset, at);
    }
    offset += font.length;
    return copy;
  });
  return Buffer.concat([header, ...rebased]);
}

describe('readFontLineRatio', () => {
  let dir: string;
  const write = (name: string, data: Buffer) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, data);
    return file;
  };

  beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'font-metrics-')); });
  afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  test('uses OS/2 win ascent + descent, like libass (Noto Sans)', async () => {
    const file = write('noto.ttf', sfnt({ upm: 1000, win: [1124, 395], typo: [1069, -293], hhea: [1069, -293] }));
    expect(await readFontLineRatio(file)).toBeCloseTo(1.519);
  });

  test('falls back to typo, then hhea, metrics', async () => {
    expect(await readFontLineRatio(write('typo.ttf', sfnt({ upm: 2048, typo: [1491, -431] })))).toBeCloseTo(1922 / 2048);
    expect(await readFontLineRatio(write('hhea.ttf', sfnt({ upm: 2048, hhea: [1854, -434] })))).toBeCloseTo(2288 / 2048);
    expect(await readFontLineRatio(write('none.ttf', sfnt({ upm: 1000 })))).toBeNull();
  });

  test('reads the requested font of a collection', async () => {
    const file = write('pair.ttc', ttc([
      sfnt({ upm: 1000, win: [1000, 200] }),
      sfnt({ upm: 1000, win: [1100, 400] }),
    ]));
    expect(await readFontLineRatio(file, 0)).toBeCloseTo(1.2);
    expect(await readFontLineRatio(file, 1)).toBeCloseTo(1.5);
  });

  test('rejects truncated files', async () => {
    await expect(readFontLineRatio(write('short.ttf', Buffer.from('true')))).rejects.toThrow();
  });
});

describe('font family names', () => {
  test('only plain names reach fontconfig', () => {
    expect(isSafeFontFamily('Noto Sans')).toBe(true);
    expect(isSafeFontFamily("Courier New")).toBe(true);
    expect(isSafeFontFamily('Noto Sans CJK SC')).toBe(true);
    expect(isSafeFontFamily('Sans:weight=200')).toBe(false);
    expect(isSafeFontFamily('Sans-12')).toBe(false);
    expect(isSafeFontFamily('')).toBe(false);
    expect(isSafeFontFamily('x'.repeat(101))).toBe(false);
  });

  test('unsafe names get the default without running fc-match', async () => {
    expect(await getExportFontMetrics('--help')).toEqual(DEFAULT_EXPORT_FONT);
  });
});
