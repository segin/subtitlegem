import * as fc from 'fast-check';
import { hexToAssColor, formatAssTime, sanitizeAssText } from './ass-utils';

describe('ass-utils properties', () => {

  describe('hexToAssColor', () => {
    test('converts valid hex codes correctly', () => {
      // Manual hex generator since hexaString might be missing in older fast-check
      const hexChar = fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'A', 'B', 'C', 'D', 'E', 'F');
      
      fc.assert(
        fc.property(fc.array(hexChar, {minLength: 6, maxLength: 6}).map(arr => arr.join('')), (hex: string) => {
          const color = hexToAssColor('#' + hex);
          // ASS format is &HBBGGRR&
          // input RRGGBB
          const r = hex.substring(0, 2);
          const g = hex.substring(2, 4);
          const b = hex.substring(4, 6);
          
          expect(color.toUpperCase()).toBe(`&H${b}${g}${r}&`.toUpperCase());
        })
      );
    });

    test('handles undefined/invalid input gracefully (defaults to white)', () => {
        expect(hexToAssColor(undefined)).toBe('&HFFFFFF&');
        // Implementation might default to white for any non-# input?
        // Line 9: if (hex.startsWith('#'))
        expect(hexToAssColor('invalid')).toBe('&HFFFFFF&');
    });
  });

  describe('formatAssTime', () => {
    test('formats time string correctly', () => {
      fc.assert(
        fc.property(fc.double({min: 0, max: 36000, noNaN: true}), (seconds) => {
           const formatted = formatAssTime(seconds);
           expect(formatted).toMatch(/^\d+:\d{2}:\d{2}\.\d{2}$/);
        })
      );
    });
  });

  describe('sanitizeAssText', () => {
    test('removes braces and converts newlines', () => {
      fc.assert(
        fc.property(fc.string(), (text) => {
          const sanitized = sanitizeAssText(text);
          // Should not have braces
          expect(sanitized).not.toMatch(/\{.*\}/); 
          // Note: The regex in implementation is \{[^}]*\} which removes explicit tags {tag}
          // but might leave unmatched braces? Strict check depends on regex.
          // Implementation: text.replace(/\{[^}]*\}/g, '')
          // Checks:
          if (text === '{tag}content') expect(sanitized).toBe('content');
          
          // Newlines -> \N
          if (text.includes('\n')) {
             expect(sanitized).toContain('\\N');
             expect(sanitized).not.toContain('\n');
          }
        })
      );
    });
  });

});
