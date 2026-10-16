/**
 * Server-side normalization of AI provider output into editor-ready subtitles.
 */
import { randomUUID } from "crypto";
import { SubtitleLine } from "@/types/subtitle";
import { parseTimestamp } from "./time-utils";

function toSeconds(value: unknown): number {
  if (typeof value === "number" || typeof value === "string") {
    return Math.max(0, parseTimestamp(value));
  }
  return 0;
}

/**
 * Convert raw AI output (string "HH:MM:SS,mmm" or numeric times, no IDs) into
 * SubtitleLines with numeric seconds and fresh IDs.
 * Entries that aren't objects are dropped.
 */
export function normalizeGeneratedSubtitles(raw: unknown): SubtitleLine[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const startTime = toSeconds(item.startTime);
      const endTime = Math.max(startTime, toSeconds(item.endTime));
      const line: SubtitleLine = {
        id: randomUUID(),
        startTime,
        endTime,
        text: typeof item.text === "string" ? item.text : "",
      };
      if (typeof item.secondaryText === "string") {
        line.secondaryText = item.secondaryText;
      }
      return line;
    });
}

/**
 * Merge AI translation output back into the lines that were sent for
 * translation. Only `secondaryText` is taken from the AI; IDs, timing, clip
 * association and styling come from the source lines.
 *
 * Throws if the AI returned a different number of lines, rather than guessing
 * an alignment and silently attaching translations to the wrong lines.
 */
export function mergeTranslatedSubtitles(source: SubtitleLine[], raw: unknown): SubtitleLine[] {
  if (!Array.isArray(raw) || raw.length !== source.length) {
    const got = Array.isArray(raw) ? raw.length : 0;
    throw new Error(`Translation returned ${got} lines for ${source.length} input lines`);
  }

  return source.map((line, i) => {
    const item = raw[i] as Record<string, unknown> | null;
    const translated = item && typeof item.secondaryText === "string" ? item.secondaryText : undefined;
    return translated === undefined ? line : { ...line, secondaryText: translated };
  });
}
