/**
 * translation-prompt.ts - Builds the subtitle translation prompt shared by all AI providers.
 *
 * Only line text is sent: translations are merged back onto the original lines by
 * position (see mergeTranslatedSubtitles), so timestamps never need to round-trip.
 */

import { SubtitleLine } from "@/types/subtitle";

/** Neighbouring lines that help the model translate a short excerpt (e.g. a single line). */
export interface TranslationContext {
  before?: string[];
  after?: string[];
}

export function buildTranslationPrompt(
  lines: Pick<SubtitleLine, "text">[],
  targetLanguage: string,
  context: TranslationContext = {}
): string {
  const before = (context.before ?? []).filter(Boolean);
  const after = (context.after ?? []).filter(Boolean);
  const hasContext = before.length > 0 || after.length > 0;

  const sections = [
    `You are an expert subtitle translator.`,
    `Translate the 'text' field of each subtitle in "Subtitles to translate" into ${targetLanguage}.`,
    `Put the translation into the 'secondaryText' field.`,
    ``,
    `Rules:`,
    `1. Return exactly ${lines.length} object(s), in the same order as the input.`,
    `2. Output a JSON object with a 'subtitles' array.`,
  ];
  if (hasContext) {
    sections.push(
      `3. The surrounding lines are from the same video. Use them only as context, so names, tone and meaning stay consistent. Do not translate them or include them in the output.`
    );
  }
  if (before.length > 0) {
    sections.push(``, `Lines before (context only):`, JSON.stringify(before));
  }
  sections.push(``, `Subtitles to translate:`, JSON.stringify(lines.map(l => ({ text: l.text }))));
  if (after.length > 0) {
    sections.push(``, `Lines after (context only):`, JSON.stringify(after));
  }

  return sections.join("\n");
}
