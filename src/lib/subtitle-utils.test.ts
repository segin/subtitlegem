import { mergeSubtitles, getRangeSelectionIds } from './subtitle-utils';
import { SubtitleLine } from '@/types/subtitle';
import { v4 as uuidv4 } from 'uuid';

// Mock UUID to be consistent if needed, but not strictly necessary here
// We'll just generate them

function createSub(id: string, start: number, end: number, text: string, sec?: string): SubtitleLine {
  return { id, startTime: start, endTime: end, text, secondaryText: sec };
}

describe('subtitle-utils', () => {
  describe('mergeSubtitles', () => {
    it('returns null if fewer than 2 items', () => {
      expect(mergeSubtitles([])).toBeNull();
      expect(mergeSubtitles([createSub('1', 0, 1, 'a')])).toBeNull();
    });

    it('merges two subtitles correctly', () => {
      const s1 = createSub('1', 10, 12, 'Hello');
      const s2 = createSub('2', 12, 14, 'World');
      const merged = mergeSubtitles([s1, s2]);

      expect(merged).not.toBeNull();
      expect(merged!.id).toBe('1'); // Keeps first ID
      expect(merged!.startTime).toBe(10);
      expect(merged!.endTime).toBe(14);
      expect(merged!.text).toBe('Hello World');
    });

    it('merges multiple subtitles and sorts them by time', () => {
      const s1 = createSub('1', 10, 11, 'A');
      const s3 = createSub('3', 12, 13, 'C');
      const s2 = createSub('2', 11, 12, 'B'); // Out of order input

      const merged = mergeSubtitles([s1, s3, s2]);

      expect(merged!.id).toBe('1');
      expect(merged!.text).toBe('A B C');
      expect(merged!.endTime).toBe(13);
    });

    it('merges secondary text if present', () => {
      const s1 = createSub('1', 0, 1, 'Hello', 'Hola');
      const s2 = createSub('2', 1, 2, 'World', 'Mundo');
      const merged = mergeSubtitles([s1, s2]);

      expect(merged!.secondaryText).toBe('Hola Mundo');
    });

    it('handles mixed secondary text (some missing)', () => {
      const s1 = createSub('1', 0, 1, 'Hello', 'Hola');
      const s2 = createSub('2', 1, 2, 'World', undefined);
      const merged = mergeSubtitles([s1, s2]);

      expect(merged!.secondaryText).toBe('Hola'); // implicit join with empty string filtered out? 
      // Checking implementation: map(s => s.secondaryText || "").filter(t => t.length > 0).join(" ")
      // So undefined becomes "" -> filtered out. Result "Hola".
      // Wait, logically "Hola" + nothing should probably maintain spacing?
      // Implementation says: filtered out empty strings. So "Hola Mundo" vs "Hola". 
      // If we want to preserve silence in secondary track, empty string might be better than filtering?
      // For now, testing CURRENT implementation behavior.
    });
  });

  describe('getRangeSelectionIds', () => {
    const subtitles = [
      createSub('A', 0, 1, 'A'),
      createSub('B', 1, 2, 'B'),
      createSub('C', 2, 3, 'C'),
      createSub('D', 3, 4, 'D'),
      createSub('E', 4, 5, 'E'),
    ];

    it('selects range forward', () => {
      const result = getRangeSelectionIds(subtitles, 'B', 'D');
      expect(result).toEqual(['B', 'C', 'D']);
    });

    it('selects range backward', () => {
      const result = getRangeSelectionIds(subtitles, 'D', 'B');
      expect(result).toEqual(['B', 'C', 'D']); // Order in list is what matters
    });

    it('returns empty if ID not found', () => {
      expect(getRangeSelectionIds(subtitles, 'B', 'Z')).toEqual([]);
    });

    it('returns single item range if anchor == target', () => {
      expect(getRangeSelectionIds(subtitles, 'C', 'C')).toEqual(['C']);
    });
  });
});
