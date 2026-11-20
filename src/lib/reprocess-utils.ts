import { SubtitleLine } from "@/types/subtitle";

/** Fresh subtitles for one source video, from /api/process mode "reprocess" */
export interface ReprocessedClip {
  /** Library clip ID; "" for a single-video project */
  videoClipId: string;
  /** clipId to put on the new lines (the timeline clip ID); undefined for a single-video project */
  lineClipId?: string;
  /** In the source video's time */
  subtitles: SubtitleLine[];
}

/**
 * Apply reprocessed subtitles to the editor's lines.
 *
 * - "replace": each reprocessed video's lines are swapped for the new ones,
 *   in the same position in the list; other videos' lines are untouched.
 * - "merge" ("Update text only"): existing lines keep their timing and
 *   styling; each takes the text of the new lines it overlaps most.
 *   Lines nothing overlaps keep their text.
 *
 * `videoClipIdOf` says which source video an existing line belongs to.
 */
export function applyReprocessedSubtitles(
  current: SubtitleLine[],
  results: ReprocessedClip[],
  mode: 'replace' | 'merge',
  videoClipIdOf: (line: SubtitleLine) => string
): SubtitleLine[] {
  const byVideo = new Map(results.map(r => [r.videoClipId, r]));
  const freshLines = (r: ReprocessedClip) =>
    r.subtitles.map(s => ({ ...s, ...(r.lineClipId !== undefined ? { clipId: r.lineClipId } : {}) }));

  if (mode === 'merge') {
    const merged = new Map<string, SubtitleLine>();
    for (const result of results) {
      const existing = current.filter(line => videoClipIdOf(line) === result.videoClipId);
      for (const line of mergeText(existing, result.subtitles)) merged.set(line.id, line);
    }
    return current.map(line => merged.get(line.id) ?? line);
  }

  const output: SubtitleLine[] = [];
  const inserted = new Set<string>();
  for (const line of current) {
    const videoClipId = videoClipIdOf(line);
    const result = byVideo.get(videoClipId);
    if (!result) {
      output.push(line);
    } else if (!inserted.has(videoClipId)) {
      // The new lines take the place of this video's first old line
      output.push(...freshLines(result));
      inserted.add(videoClipId);
    }
  }
  for (const result of results) {
    if (!inserted.has(result.videoClipId)) output.push(...freshLines(result));
  }
  return output;
}

function overlap(a: SubtitleLine, b: SubtitleLine): number {
  return Math.min(a.endTime, b.endTime) - Math.max(a.startTime, b.startTime);
}

/** Give each existing line the text of the fresh lines that overlap it most (in time order) */
function mergeText(existing: SubtitleLine[], fresh: SubtitleLine[]): SubtitleLine[] {
  const assigned = new Map<string, SubtitleLine[]>();
  for (const line of [...fresh].sort((a, b) => a.startTime - b.startTime)) {
    if (line.placeholder) continue;
    let best: SubtitleLine | null = null;
    let bestOverlap = 0;
    for (const target of existing) {
      const o = overlap(line, target);
      if (o > bestOverlap) { best = target; bestOverlap = o; }
    }
    if (best) assigned.set(best.id, [...(assigned.get(best.id) ?? []), line]);
  }

  return existing.map(line => {
    const sources = assigned.get(line.id);
    if (!sources) return line;
    const secondary = sources.map(s => s.secondaryText).filter((t): t is string => !!t);
    return {
      ...line,
      text: sources.map(s => s.text).join(' '),
      ...(secondary.length > 0 && { secondaryText: secondary.join(' ') }),
    };
  });
}
