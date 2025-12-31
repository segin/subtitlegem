/**
 * Input validation utilities for AI and API handlers
 * Prevents DoS attacks via oversized inputs
 */

/**
 * Maximum number of subtitles allowed in a single request
 * Prevents DoS via memory exhaustion from oversized arrays
 */
export const MAX_SUBTITLES = 10000;

/**
 * Maximum total character count for subtitle text
 * Prevents DoS via memory exhaustion from huge text content
 */
export const MAX_TOTAL_TEXT_LENGTH = 1_000_000; // 1MB of text

/**
 * Validate subtitle array size to prevent DoS attacks
 * @throws Error if validation fails
 */
export function validateSubtitleArraySize(subtitles: unknown[]): void {
  if (!Array.isArray(subtitles)) {
    throw new Error('Subtitles must be an array');
  }
  if (subtitles.length > MAX_SUBTITLES) {
    throw new Error(`Too many subtitles: ${subtitles.length} exceeds maximum of ${MAX_SUBTITLES}`);
  }
}

/**
 * Validate subtitle text content size
 * @throws Error if total text content exceeds limit
 */
export function validateSubtitleTextSize(subtitles: Array<{ text?: string; secondaryText?: string }>): void {
  let totalLength = 0;
  for (const sub of subtitles) {
    totalLength += (sub.text?.length || 0) + (sub.secondaryText?.length || 0);
    if (totalLength > MAX_TOTAL_TEXT_LENGTH) {
      throw new Error(`Subtitle text too large: exceeds ${MAX_TOTAL_TEXT_LENGTH} characters`);
    }
  }
}

/**
 * Full subtitle validation combining array size and text size checks
 */
export function validateSubtitles(subtitles: unknown): void {
  // Type check
  if (!Array.isArray(subtitles)) {
    throw new Error('Subtitles must be an array');
  }
  
  // Size checks
  validateSubtitleArraySize(subtitles);
  validateSubtitleTextSize(subtitles as Array<{ text?: string; secondaryText?: string }>);
}
