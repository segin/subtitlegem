/**
 * ass-utils.test.ts - Comprehensive tests for ASS subtitle generation
 * 
 * Unit tests, property-based tests, and fuzz tests for:
 * - hexToAssColor: Hex to ASS BGR color conversion
 * - formatAssTime: Seconds to ASS timestamp format
 * - sanitizeAssText: Strip ASS tags from text
 * - generateAss: Full ASS file generation
 */

import * as fc from 'fast-check';
import { 
  hexToAssColor, 
  formatAssTime, 
  sanitizeAssText, 
  generateAss,
  VideoDimensions 
} from './ass-utils';
import { SubtitleLine, SubtitleConfig, DEFAULT_CONFIG } from '@/types/subtitle';
import { generateSrtContent } from './time-utils';

// Helper to generate hex color strings (always uppercase for consistency)
const hexColorArb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([r, g, b]) => 
  '#' + r.toString(16).toUpperCase().padStart(2, '0') + 
        g.toString(16).toUpperCase().padStart(2, '0') + 
        b.toString(16).toUpperCase().padStart(2, '0')
);

// ============================================================================
// hexToAssColor Tests
// ============================================================================

describe('hexToAssColor', () => {
  describe('unit tests', () => {
    test('converts valid hex color correctly', () => {
      expect(hexToAssColor('#FF0000')).toBe('&H0000FF&'); // Red -> BGR
      expect(hexToAssColor('#00FF00')).toBe('&H00FF00&'); // Green stays
      expect(hexToAssColor('#0000FF')).toBe('&HFF0000&'); // Blue -> BGR
      expect(hexToAssColor('#FFFFFF')).toBe('&HFFFFFF&'); // White
      expect(hexToAssColor('#000000')).toBe('&H000000&'); // Black
    });

    test('handles lowercase hex', () => {
      expect(hexToAssColor('#ff0000')).toBe('&H0000ff&');
      expect(hexToAssColor('#aabbcc')).toBe('&Hccbbaa&');
    });

    test('returns white for undefined input', () => {
      expect(hexToAssColor(undefined)).toBe('&HFFFFFF&');
    });

    test('returns white for empty string', () => {
      expect(hexToAssColor('')).toBe('&HFFFFFF&');
    });

    test('returns white for invalid hex (no hash)', () => {
      expect(hexToAssColor('FF0000')).toBe('&HFFFFFF&');
    });

    test('handles rgba format (uses first 6 chars after #)', () => {
      expect(hexToAssColor('#FF0000FF')).toBe('&H0000FF&');
    });
  });

  describe('property tests', () => {
    test('output always starts with &H and ends with &', () => {
      fc.assert(
        fc.property(hexColorArb, (hex) => {
          const result = hexToAssColor(hex);
          return result.startsWith('&H') && result.endsWith('&');
        })
      );
    });

    test('conversion is consistent (same input = same output)', () => {
      fc.assert(
        fc.property(hexColorArb, (hex) => {
          return hexToAssColor(hex) === hexToAssColor(hex);
        })
      );
    });
  });
});

// ============================================================================
// formatAssTime Tests
// ============================================================================

describe('formatAssTime', () => {
  describe('unit tests', () => {
    test('formats zero correctly', () => {
      expect(formatAssTime(0)).toBe('0:00:00.00');
    });

    test('formats whole seconds', () => {
      expect(formatAssTime(1)).toBe('0:00:01.00');
      expect(formatAssTime(59)).toBe('0:00:59.00');
      expect(formatAssTime(60)).toBe('0:01:00.00');
      expect(formatAssTime(3600)).toBe('1:00:00.00');
    });

    test('formats fractional seconds (centiseconds)', () => {
      expect(formatAssTime(1.5)).toBe('0:00:01.50');
      expect(formatAssTime(1.05)).toBe('0:00:01.05');
      expect(formatAssTime(1.99)).toBe('0:00:01.99');
    });

    test('handles very small fractions', () => {
      expect(formatAssTime(0.01)).toBe('0:00:00.01');
      expect(formatAssTime(0.001)).toBe('0:00:00.00'); // Below centisecond precision
    });

    test('handles negative values gracefully', () => {
      const result = formatAssTime(-1);
      expect(typeof result).toBe('string');
    });
  });

  describe('property tests', () => {
    test('output format is always H:MM:SS.CC', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 86399, noNaN: true }), (seconds) => {
          const result = formatAssTime(seconds);
          return /^\d+:\d{2}:\d{2}\.\d{2}$/.test(result);
        })
      );
    });

    test('larger seconds produce later timestamps', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 3600, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          (a, delta) => {
            const b = a + delta;
            const timeA = formatAssTime(a);
            const timeB = formatAssTime(b);
            const parseTime = (t: string) => {
              const m = t.match(/^(\d+):(\d{2}):(\d{2})\.(\d{2})$/);
              if (!m) return 0;
              return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 100;
            };
            return parseTime(timeA) <= parseTime(timeB);
          }
        )
      );
    });
  });
});

// ============================================================================
// sanitizeAssText Tests
// ============================================================================

describe('sanitizeAssText', () => {
  describe('unit tests', () => {
    test('removes simple ASS tags', () => {
      expect(sanitizeAssText('{\\b1}Bold{\\b0}')).toBe('Bold');
      expect(sanitizeAssText('{\\i1}Italic')).toBe('Italic');
    });

    test('removes color tags', () => {
      expect(sanitizeAssText('{\\c&HFF0000&}Red text')).toBe('Red text');
    });

    test('removes multiple tags', () => {
      expect(sanitizeAssText('{\\b1}{\\i1}Both{\\b0}{\\i0}')).toBe('Both');
    });

    test('preserves text without tags', () => {
      expect(sanitizeAssText('Hello World')).toBe('Hello World');
      expect(sanitizeAssText('')).toBe('');
    });

    test('handles curly braces that look like tags', () => {
      expect(sanitizeAssText('Math: {x + y}')).toBe('Math: ');
    });

    test('does not match across multiple brace pairs', () => {
      expect(sanitizeAssText('{a}text{b}')).toBe('text');
    });

    test('escapes newlines', () => {
      expect(sanitizeAssText('Line 1\nLine 2')).toBe('Line 1\\NLine 2');
      expect(sanitizeAssText('Line 1\r\nLine 2')).toBe('Line 1\\NLine 2');
    });
  });

  describe('property tests', () => {
    test('output never contains {...} patterns', () => {
      fc.assert(
        fc.property(fc.string(), (text) => {
          const result = sanitizeAssText(text);
          return !/\{[^}]*\}/.test(result);
        })
      );
    });

    test('output length is <= input length', () => {
      fc.assert(
        fc.property(fc.string(), (text) => {
          return sanitizeAssText(text).length <= text.length;
        })
      );
    });

    test('text without braces is unchanged', () => {
      fc.assert(
        fc.property(fc.string().filter(s => !s.includes('{') && !s.includes('}')), (text) => {
          return sanitizeAssText(text) === text;
        })
      );
    });
  });

  describe('fuzz tests', () => {
    test('handles various strings', () => {
      fc.assert(
        fc.property(fc.string(), (text) => {
          const result = sanitizeAssText(text);
          return typeof result === 'string';
        }),
        { numRuns: 1000 }
      );
    });

    test('handles very long strings', () => {
      const longText = 'A'.repeat(100000);
      expect(() => sanitizeAssText(longText)).not.toThrow();
    });

    test('handles strings with many braces', () => {
      const manyBraces = '{a}{b}{c}{d}{e}'.repeat(1000);
      expect(() => sanitizeAssText(manyBraces)).not.toThrow();
      expect(sanitizeAssText(manyBraces)).toBe('');
    });
  });
});

// ============================================================================
// generateAss Tests
// ============================================================================

describe('generateAss', () => {
  const createSubtitle = (overrides: Partial<SubtitleLine> = {}): SubtitleLine => ({
    id: 'test-1',
    startTime: 0,
    endTime: 5,
    text: 'Test subtitle',
    ...overrides,
  });

  const defaultConfig: SubtitleConfig = { ...DEFAULT_CONFIG };

  describe('unit tests', () => {
    test('leaves out editor-only placeholder lines', () => {
      const result = generateAss([
        createSubtitle({ text: 'Spoken line', secondaryText: 'Translated' }),
        createSubtitle({ id: 'gap', text: '[Subtitles missing 0:45-0:50: Gemini would not transcribe this part]', secondaryText: 'x', placeholder: true }),
      ], defaultConfig);
      expect(result).toContain('Spoken line');
      expect(result).not.toContain('Subtitles missing');
      expect(result.match(/^Dialogue:/gm)).toHaveLength(2); // primary + secondary of the real line
      expect(generateSrtContent([
        createSubtitle({ text: 'Spoken line' }),
        createSubtitle({ id: 'gap', text: '[Subtitles missing]', placeholder: true }),
      ], 'primary')).not.toContain('Subtitles missing');
    });

    const styleFields = (ass: string, name: 'Primary' | 'Secondary') => {
      const line = ass.split('\n').find(l => l.startsWith(`Style: ${name},`));
      if (!line) throw new Error(`no ${name} style`);
      const [, Fontname, Fontsize, PrimaryColour, , OutlineColour, BackColour, , , , , , , , , BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV] =
        line.slice('Style: '.length).split(',');
      return { Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV };
    };

    test('no background box by default: outline only, in the outline colour', () => {
      const s = styleFields(generateAss([createSubtitle()], defaultConfig), 'Primary');
      expect(s.BorderStyle).toBe('1');
      expect(s.Shadow).toBe('0');
      expect(s.Outline).toBe('2.2'); // 0.2% of 1080
      expect(s.OutlineColour).toBe('&H00000000');
      expect(s.PrimaryColour).toBe('&H00FFFFFF');
      expect(s.Fontname).toBe('Noto Sans');
    });

    test('a background colour draws a box (BorderStyle 4) with its transparency and padding', () => {
      const config: SubtitleConfig = {
        ...defaultConfig,
        primary: { backgroundColor: 'rgba(0,0,0,0.7)', outlineColor: '#ff0000', color: '#ffff00' },
      };
      const s = styleFields(generateAss([createSubtitle()], config, { width: 1920, height: 1080 }), 'Primary');
      expect(s.BorderStyle).toBe('4');
      expect(s.BackColour).toBe('&H4D000000');       // 70% opaque black
      expect(s.OutlineColour).toBe('&H000000FF');    // red, as chosen
      expect(s.PrimaryColour).toBe('&H0000FFFF');    // yellow
      expect(s.Fontsize).toBe('108');
      // libass pads the box by Outline + Shadow: a tenth of the 108 px line height
      expect(Number(s.Outline) + Number(s.Shadow)).toBeCloseTo(10.8, 1);
    });

    test('an opaque hex background works too; transparent or none means no box', () => {
      const boxed = generateAss([createSubtitle()], { ...defaultConfig, secondary: { backgroundColor: '#202020' } });
      expect(styleFields(boxed, 'Secondary').BorderStyle).toBe('4');
      expect(styleFields(boxed, 'Secondary').BackColour).toBe('&H00202020');
      for (const backgroundColor of ['transparent', 'none', 'rgba(0,0,0,0)']) {
        const plain = generateAss([createSubtitle()], { ...defaultConfig, primary: { backgroundColor } });
        expect(styleFields(plain, 'Primary').BorderStyle).toBe('1');
      }
    });

    test('Global Settings styles apply under project overrides', () => {
      const globalStyles = {
        defaultPrimaryStyle: { color: '#00ff00', fontSize: 3, backgroundColor: '#000000' },
      };
      const inherited = styleFields(generateAss([createSubtitle()], defaultConfig, undefined, globalStyles), 'Primary');
      expect(inherited.PrimaryColour).toBe('&H0000FF00');
      expect(inherited.Fontsize).toBe('65'); // 3% of 1080, doubled
      expect(inherited.BorderStyle).toBe('4');
      const overridden = styleFields(
        generateAss([createSubtitle()], { ...defaultConfig, primary: { fontSize: 4 } }, undefined, globalStyles),
        'Primary',
      );
      expect(overridden.Fontsize).toBe('86');
      expect(overridden.PrimaryColour).toBe('&H0000FF00');
    });

    test('a font list from the style panel becomes a single font name', () => {
      const ass = generateAss([createSubtitle()], { ...defaultConfig, primary: { fontFamily: 'Georgia, serif' } });
      expect(styleFields(ass, 'Primary').Fontname).toBe('Georgia');
      expect(styleFields(ass, 'Primary').Alignment).toBe('2'); // fields after the font stay in place
    });

    test('hidden languages are left out of the events', () => {
      const subs = [createSubtitle({ text: 'Spoken', secondaryText: 'Translated' })];
      const noPrimary = generateAss(subs, { ...defaultConfig, showPrimary: false });
      expect(noPrimary).not.toContain(',Primary,,0,0,0,,Spoken');
      expect(noPrimary).toContain(',Secondary,,0,0,0,,Translated');
      const noSecondary = generateAss(subs, { ...defaultConfig, showSecondary: false });
      expect(noSecondary).toContain(',Primary,,0,0,0,,Spoken');
      expect(noSecondary).not.toContain('Translated');
      expect(generateAss(subs, { ...defaultConfig, showPrimary: false, showSecondary: false })).not.toContain('Dialogue:');
    });

    test('font size 0 still hides a language, as older projects relied on', () => {
      const subs = [createSubtitle({ text: 'Spoken', secondaryText: 'Translated' })];
      const ass = generateAss(subs, { ...defaultConfig, primary: { fontSize: 0 } });
      expect(ass).not.toContain('Spoken');
      expect(ass).toContain('Translated');
    });

    test('generates valid ASS structure', () => {
      const subtitles = [createSubtitle()];
      const result = generateAss(subtitles, defaultConfig);
      
      expect(result).toContain('[Script Info]');
      expect(result).toContain('[V4+ Styles]');
      expect(result).toContain('[Events]');
    });

    test('includes PlayRes for video dimensions', () => {
      const subtitles = [createSubtitle()];
      const dimensions: VideoDimensions = { width: 1920, height: 1080 };
      const result = generateAss(subtitles, defaultConfig, dimensions);
      
      expect(result).toContain('PlayResX: 1920');
      expect(result).toContain('PlayResY: 1080');
    });

    test('uses default 1080p when no dimensions provided', () => {
      const subtitles = [createSubtitle()];
      const result = generateAss(subtitles, defaultConfig);
      
      expect(result).toContain('PlayResX: 1920');
      expect(result).toContain('PlayResY: 1080');
    });

    test('handles empty subtitle list', () => {
      const result = generateAss([], defaultConfig);
      
      expect(result).toContain('[Script Info]');
      expect(result).toContain('[Events]');
      expect(result).toContain('Format: Layer');
      expect(result).not.toContain('Dialogue:');
    });

    test('generates dialogue lines for subtitles', () => {
      const subtitles = [
        createSubtitle({ id: '1', startTime: 0, endTime: 5, text: 'First' }),
        createSubtitle({ id: '2', startTime: 5, endTime: 10, text: 'Second' }),
      ];
      const result = generateAss(subtitles, defaultConfig);
      
      expect(result).toContain('Dialogue: 0,0:00:00.00,0:00:05.00,Primary,,0,0,0,,First');
      expect(result).toContain('Dialogue: 0,0:00:05.00,0:00:10.00,Primary,,0,0,0,,Second');
    });

    test('generates secondary track for bilingual subtitles', () => {
      const subtitles = [
        createSubtitle({ text: 'English', secondaryText: '中文' }),
      ];
      const result = generateAss(subtitles, defaultConfig);
      
      expect(result).toContain('Primary,,0,0,0,,English');
      expect(result).toContain('Secondary,,0,0,0,,中文');
    });

    test('sanitizes subtitle text - removes ASS tags', () => {
      const subtitles = [
        createSubtitle({ text: '{\\b1}Bold{\\b0} text' }),
      ];
      const result = generateAss(subtitles, defaultConfig);
      
      expect(result).toContain('Bold text');
      expect(result).not.toContain('{\\b1}');
      expect(result).not.toContain('{\\b0}');
    });

    test('handles custom video dimensions (scales font size)', () => {
      const subtitles = [createSubtitle()];
      // 4K Input (3840x2160) -> 2x Reference (1920x1080)
      // Font Size 5% of 1080 = 54. 
      // Scaled by 2 = 108.
      const dimensions: VideoDimensions = { width: 3840, height: 2160 };
      const result = generateAss(subtitles, defaultConfig, dimensions);
      
      expect(result).toContain('PlayResX: 3840');
      expect(result).toContain('PlayResY: 2160');
      
      // Verify font size is scaled to ~108
      // Style format: Name, Fontname, Fontsize, ...
      // Default Primary font is 5% -> 108px. NOW DOUBLED to 10% -> 216px
      expect(result).toContain(',216,');
    });

    test('handles vertical video aspect ratio correctly', () => {
        const subtitles = [createSubtitle()];
        // Vertical 9:16 (1080x1920)
        // PlayRes matches video
        const dimensions: VideoDimensions = { width: 1080, height: 1920 };
        const result = generateAss(subtitles, defaultConfig, dimensions);
        
        expect(result).toContain('PlayResX: 1080');
        expect(result).toContain('PlayResY: 1920');
        
        // Font size calculation for vertical video:
        // Base size 1920 * 0.05 = 96px (assuming scaling based on height for consistency in vertical?)
        // Actually logic might use width or min dimension.
        // Let's see previous expectation was 96. 96 * 2 = 192.
        // ScaleY = 1920/1080 = 1.777...
        // Font 54 * 1.777 = ~96
        expect(result).toContain(',192,');
    });
  });

  describe('property tests', () => {
    test('output always contains required sections', () => {
      fc.assert(
        fc.property(
          fc.array(fc.record({
            id: fc.uuid(),
            startTime: fc.float({ min: 0, max: 3600, noNaN: true }),
            endTime: fc.float({ min: 0, max: 3600, noNaN: true }),
            text: fc.string({ minLength: 1 }),
          }), { maxLength: 10 }),
          (subs) => {
            const subtitles = subs.map(s => ({ ...s, endTime: Math.max(s.startTime + 0.1, s.endTime) }));
            const result = generateAss(subtitles as SubtitleLine[], defaultConfig);
            return result.includes('[Script Info]') &&
                   result.includes('[V4+ Styles]') &&
                   result.includes('[Events]');
          }
        )
      );
    });

    test('dialogue count matches subtitle count', () => {
      fc.assert(
        fc.property(
          fc.array(fc.record({
            id: fc.uuid(),
            startTime: fc.float({ min: 0, max: 100, noNaN: true }),
            endTime: fc.float({ min: 0, max: 100, noNaN: true }),
            text: fc.string({ minLength: 1 }).filter(s => !s.includes('Dialogue:')),
          }), { minLength: 1, maxLength: 20 }),
          (subs) => {
            const subtitles = subs.map(s => ({ ...s, endTime: Math.max(s.startTime + 0.1, s.endTime) }));
            const result = generateAss(subtitles as SubtitleLine[], defaultConfig);
            const dialogueCount = (result.match(/Dialogue:/g) || []).length;
            return dialogueCount === subtitles.length;
          }
        )
      );
    });
  });

  describe('fuzz tests', () => {
    test('handles subtitles with various text', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (text) => {
          const subtitles = [createSubtitle({ text })];
          const result = generateAss(subtitles, defaultConfig);
          return typeof result === 'string' && result.includes('[Events]');
        }),
        { numRuns: 500 }
      );
    });

    test('handles many subtitles', () => {
      const subtitles = Array.from({ length: 1000 }, (_, i) => 
        createSubtitle({ 
          id: `sub-${i}`, 
          startTime: i, 
          endTime: i + 0.9, 
          text: `Subtitle ${i}` 
        })
      );
      
      expect(() => generateAss(subtitles, defaultConfig)).not.toThrow();
      const result = generateAss(subtitles, defaultConfig);
      expect((result.match(/Dialogue:/g) || []).length).toBe(1000);
    });
  });
});
