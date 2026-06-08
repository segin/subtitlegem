import { SubtitleLine } from "@/types/subtitle";

/**
 * Calculates the range of subtitles to select based on anchor and target IDs.
 * Used for Shift-click selection.
 */
export function getRangeSelectionIds(
  subtitles: SubtitleLine[], 
  anchorId: string, 
  targetId: string
): string[] {
  if (!anchorId || !targetId) return [];
  
  let anchorIndex = -1;
  let targetIndex = -1;

  // Single-pass O(N) lookup for both indices
  for (let i = 0; i < subtitles.length; i++) {
    const id = subtitles[i].id;
    if (anchorIndex === -1 && id === anchorId) anchorIndex = i;
    if (targetIndex === -1 && id === targetId) targetIndex = i;

    // Break early if both are found
    if (anchorIndex !== -1 && targetIndex !== -1) break;
  }
  
  if (anchorIndex === -1 || targetIndex === -1) return [];

  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  
  return subtitles.slice(start, end + 1).map(s => s.id);
}

/**
 * Merges a list of subtitles into a single subtitle.
 * Preserves the ID of the first subtitle.
 * Joins text with spaces.
 */
export function mergeSubtitles(itemsToMerge: SubtitleLine[]): SubtitleLine | null {
  if (!itemsToMerge || itemsToMerge.length < 2) return null;

  // Ensure sorted by time (treat NaN as 0)
  const sorted = [...itemsToMerge].sort((a, b) => {
    const startA = isNaN(a.startTime) ? 0 : a.startTime;
    const startB = isNaN(b.startTime) ? 0 : b.startTime;
    return startA - startB;
  });

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  
  // Calculate max end time (handle overlaps where earlier item ends later)
  // Filter out NaNs to prevent propagation
  const validEndTimes = sorted.map(s => s.endTime).filter(t => !isNaN(t) && isFinite(t));
  const maxEndTime = validEndTimes.length > 0 ? Math.max(...validEndTimes) : last.endTime || 0;

  // Merge primary text
  const mergedText = sorted
    .map(s => s.text ? s.text.trim() : "")
    .filter(t => t.length > 0)
    .join(" ");

  // Merge secondary text (if any exist)
  const hasSecondary = sorted.some(s => !!s.secondaryText);
  let mergedSecondary: string | undefined = undefined;
  
  if (hasSecondary) {
    mergedSecondary = sorted
      .map(s => s.secondaryText ? s.secondaryText.trim() : "")
      .filter(t => t.length > 0)
      .join(" ");
  }

  return {
    id: first.id, // Keep ID of first item
    startTime: isNaN(first.startTime) ? 0 : first.startTime,
    endTime: maxEndTime,
    text: mergedText,
    secondaryText: mergedSecondary,
    // Inherit colors from first item if present
    primaryColor: first.primaryColor,
    secondaryColor: first.secondaryColor
  };
}
