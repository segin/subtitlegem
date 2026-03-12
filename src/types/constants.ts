/**
 * Reference resolution constants for subtitle rendering and video processing.
 * 
 * SubtitleGem uses 1080p (1920x1080) as the reference resolution for:
 * - Font sizes specified as percentages
 * - Margin calculations  
 * - ASS subtitle PlayRes values
 * - Video size estimation
 */

/** Reference width (1920px for Full HD) */
export const REFERENCE_WIDTH = 1920;

/** Reference height (1080px for Full HD) */
export const REFERENCE_HEIGHT = 1080;

/** Reference pixel count (1920 * 1080 = 2,073,600) */
export const REFERENCE_PIXELS = REFERENCE_WIDTH * REFERENCE_HEIGHT;

/** Default frame rate for projects */
export const DEFAULT_FPS = 30;

/** Default primary language for subtitles */
export const DEFAULT_PRIMARY_LANGUAGE = 'English';

/** Default secondary language for subtitles (placeholder) */
export const DEFAULT_SECONDARY_LANGUAGE = 'Secondary';

/** Default secondary language for global settings */
export const DEFAULT_GLOBAL_SECONDARY_LANGUAGE = 'Simplified Chinese';

/** Default AI model for processing */
export const DEFAULT_AI_MODEL = 'gemini-2.0-flash';
