/**
 * style-resolver.test.ts - Comprehensive tests for style resolution
 * 
 * Unit tests and property-based tests for:
 * - resolveTrackStyle: Merge global, project, and line styles
 * - normalizeToPx: Convert % or px values to pixels
 * - getPreviewStyle: Generate CSS for preview
 */

import * as fc from 'fast-check';
import { resolveTrackStyle, normalizeToPx, getPreviewStyle } from './style-resolver';
import { TrackStyle, DEFAULT_GLOBAL_SETTINGS } from '@/types/subtitle';

// ============================================================================
// resolveTrackStyle Tests
// ============================================================================

describe('resolveTrackStyle', () => {
  const baseStyle: TrackStyle = {
    alignment: 2,
    fontSize: 48,
    color: '#ffffff',
    fontFamily: 'Arial',
    marginV: 50,
    marginH: 40,
    backgroundColor: 'rgba(0,0,0,0.7)',
  };

  describe('unit tests', () => {
    test('returns base style when no overrides', () => {
      const result = resolveTrackStyle(baseStyle);
      expect(result).toEqual(baseStyle);
    });

    test('project override replaces base values', () => {
      const projectOverride = { fontSize: 64, color: '#ff0000' };
      const result = resolveTrackStyle(baseStyle, projectOverride);
      
      expect(result.fontSize).toBe(64);
      expect(result.color).toBe('#ff0000');
      expect(result.fontFamily).toBe('Arial');
    });

    test('line override has highest priority', () => {
      const projectOverride = { fontSize: 64 };
      const lineOverride = { fontSize: 32 };
      const result = resolveTrackStyle(baseStyle, projectOverride, lineOverride);
      
      expect(result.fontSize).toBe(32);
    });

    test('handles undefined overrides', () => {
      const result = resolveTrackStyle(baseStyle, undefined, undefined);
      expect(result).toEqual(baseStyle);
    });

    test('handles empty overrides', () => {
      const result = resolveTrackStyle(baseStyle, {}, {});
      expect(result).toEqual(baseStyle);
    });

    test('partial overrides preserve other fields', () => {
      const result = resolveTrackStyle(
        baseStyle, 
        { alignment: 8 }, 
        { fontSize: 24 }
      );
      
      expect(result.alignment).toBe(8);
      expect(result.fontSize).toBe(24);
      expect(result.color).toBe('#ffffff');
      expect(result.fontFamily).toBe('Arial');
    });
  });

  describe('property tests', () => {
    test('result always has all required fields from base', () => {
      fc.assert(
        fc.property(
          fc.record({
            alignment: fc.constant(2 as const),
            fontSize: fc.oneof(fc.integer({ min: 1, max: 200 }), fc.constant('5%')),
            color: fc.constant('#ffffff'),
            fontFamily: fc.string({ minLength: 1 }),
            marginV: fc.integer({ min: 0, max: 500 }),
            marginH: fc.integer({ min: 0, max: 500 }),
            backgroundColor: fc.string(),
          }),
          fc.option(fc.record({ fontSize: fc.integer({ min: 1, max: 200 }) }), { nil: undefined }),
          (base, override) => {
            const result = resolveTrackStyle(base as TrackStyle, override);
            return (
              result.alignment !== undefined &&
              result.fontSize !== undefined &&
              result.color !== undefined &&
              result.fontFamily !== undefined &&
              result.marginV !== undefined &&
              result.marginH !== undefined &&
              result.backgroundColor !== undefined
            );
          }
        )
      );
    });

    test('line override takes precedence over project for same field', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 101, max: 200 }),
          (projectFontSize, lineFontSize) => {
            const result = resolveTrackStyle(
              baseStyle,
              { fontSize: projectFontSize },
              { fontSize: lineFontSize }
            );
            return result.fontSize === lineFontSize;
          }
        )
      );
    });
  });
});

// ============================================================================
// normalizeToPx Tests
// ============================================================================

describe('normalizeToPx', () => {
  describe('unit tests', () => {
    test('treats numbers as percentages', () => {
      // Numbers are now percentages: value% of fullSize
      expect(normalizeToPx(5, 1080)).toBe(54);    // 5% of 1080 = 54
      expect(normalizeToPx(0, 1080)).toBe(0);     // 0% of anything = 0
      expect(normalizeToPx(10, 1920)).toBe(192);  // 10% of 1920 = 192
    });

    test('converts percentage strings', () => {
      expect(normalizeToPx('5%', 1080)).toBe(54);
      expect(normalizeToPx('10%', 1920)).toBe(192);
      expect(normalizeToPx('50%', 1000)).toBe(500);
    });


    test('returns 0 for undefined', () => {
      expect(normalizeToPx(undefined, 1080)).toBe(0);
    });

    test('returns 0 for invalid percentage string', () => {
      expect(normalizeToPx('invalid', 1080)).toBe(0);
    });

    test('handles 0%', () => {
      expect(normalizeToPx('0%', 1080)).toBe(0);
    });

    test('handles 100%', () => {
      expect(normalizeToPx('100%', 1080)).toBe(1080);
    });

    test('handles decimal percentages', () => {
      expect(normalizeToPx('5.5%', 1000)).toBe(55);
      expect(normalizeToPx('0.1%', 1000)).toBe(1);
    });
  });

  describe('property tests', () => {
    test('number input is treated as percentage', () => {
      fc.assert(
        fc.property(fc.float({ min: 0, max: 100, noNaN: true }), (value) => {
          // Numbers are now percentages: value% of 1080
          const expected = (value / 100) * 1080;
          return Math.abs(normalizeToPx(value, 1080) - expected) < 0.0001;
        })
      );
    });


    test('percentage result scales with fullSize', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 100, max: 10000, noNaN: true }),
          (percent, fullSize) => {
            const expected = (percent / 100) * fullSize;
            const result = normalizeToPx(`${percent}%`, fullSize);
            return Math.abs(result - expected) < 0.0001;
          }
        )
      );
    });

    test('result is always non-negative for non-negative inputs', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.float({ min: 0, max: 1000, noNaN: true }),
            fc.float({ min: 0, max: 100, noNaN: true }).map(p => `${p}%`)
          ),
          fc.float({ min: 1, max: 10000, noNaN: true }),
          (value, fullSize) => {
            return normalizeToPx(value, fullSize) >= 0;
          }
        )
      );
    });
  });

  describe('edge cases', () => {
    test('handles very large percentages', () => {
      // 1000% as string = 1000/100 * 100 = 1000
      expect(normalizeToPx('1000%', 100)).toBe(1000);
    });

    test('handles negative percentages', () => {
      // -10% of 1000 = -100
      expect(normalizeToPx('-10%', 1000)).toBe(-100);
    });

    test('handles negative numbers (percentages)', () => {
      // -50 as percentage = -50% of 1080 = -540
      expect(normalizeToPx(-50, 1080)).toBe(-540);
    });
  });

});

// ============================================================================
// getPreviewStyle Tests
// ============================================================================

describe('getPreviewStyle', () => {
  // Sample style using percentage-based values
  const sampleStyle: TrackStyle = {
    alignment: 2,
    fontSize: 5,        // 5% of video height
    color: '#ffffff',
    fontFamily: 'Arial',
    marginV: 4,         // 4% margin
    marginH: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    outlineColor: '#000000',
    outlineWidth: 0.2,  // 0.2% outline
  };

  describe('unit tests', () => {
    test('scales font size for preview height', () => {
      const result = getPreviewStyle(sampleStyle, 360);
      // 5% of 360 = 18px
      expect(result.fontSize).toBe('18px');
    });

    test('scales font size for full 1080p', () => {
      const result = getPreviewStyle(sampleStyle, 1080);
      // 5% of 1080 = 54px
      expect(result.fontSize).toBe('54px');
    });


    test('includes font family', () => {
      const result = getPreviewStyle(sampleStyle);
      expect(result.fontFamily).toBe('Arial');
    });

    test('includes color', () => {
      const result = getPreviewStyle(sampleStyle);
      expect(result.color).toBe('#ffffff');
    });

    test('includes background color', () => {
      const result = getPreviewStyle(sampleStyle);
      expect(result.backgroundColor).toBe('rgba(0,0,0,0.7)');
    });

    test('handles percentage-based fontSize', () => {
      const styleWithPercent: TrackStyle = {
        ...sampleStyle,
        fontSize: 5, // 5% as numeric value
      };
      const result = getPreviewStyle(styleWithPercent, 1080);
      expect(result.fontSize).toBe('54px');
    });


    test('handles missing outline/shadow', () => {
      const styleWithoutEffects: TrackStyle = {
        alignment: 2,
        fontSize: 5,        // 5%
        color: '#ffffff',
        fontFamily: 'Arial',
        marginV: 4,
        marginH: 4,
        backgroundColor: 'rgba(0,0,0,0.7)',
      };
      expect(() => getPreviewStyle(styleWithoutEffects)).not.toThrow();
    });

  });

  describe('property tests', () => {
    test('fontSize is always a valid CSS value', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 200 }),
          fc.integer({ min: 100, max: 2000 }),
          (fontSize, videoHeight) => {
            const style: TrackStyle = { ...sampleStyle, fontSize };
            const result = getPreviewStyle(style, videoHeight);
            return /^\d+(\.\d+)?px$/.test(result.fontSize);
          }
        )
      );
    });

    test('scaling is proportional to video height', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }), // fontSize as percentage (1-20%)
          fc.integer({ min: 100, max: 2000 }),
          (fontSizePercent, videoHeight) => {
            const style: TrackStyle = { ...sampleStyle, fontSize: fontSizePercent };
            const result = getPreviewStyle(style, videoHeight);
            // fontSize% of videoHeight = expected pixels
            const expectedSize = (fontSizePercent / 100) * videoHeight;
            const actualSize = parseFloat(result.fontSize);
            return Math.abs(actualSize - expectedSize) < 0.001;
          }
        )
      );
    });

  });
});
