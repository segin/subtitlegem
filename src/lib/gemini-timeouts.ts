/** Deadline for a single subtitle-generation request (sent to Gemini as its server timeout too). */
export const GEMINI_REQUEST_TIMEOUT_MS = 30 * 60 * 1000;

/** Node fetch's own limit; kept above the Gemini deadline so Gemini's error is the one reported. */
export const FETCH_TIMEOUT_MS = GEMINI_REQUEST_TIMEOUT_MS + 5 * 60 * 1000;
