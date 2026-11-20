/**
 * Upload utilities for file validation and processing
 */

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

// No hard file size limit; videos > 400MB will have their audio extracted.

// Allowed video MIME types
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/mpeg',
  'video/ogg',
];

/**
 * Validate a video file for upload
 * @param file - The file to validate
 * @param maxFileSizeMB - Optional per-file size limit in MB (from Global Settings)
 */
export function validateVideoFile(file: File, maxFileSizeMB?: number): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!ALLOWED_VIDEO_TYPES.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|avi|mkv|mpeg|ogv)$/i)) {
    return { valid: false, error: 'Unsupported video format' };
  }

  if (maxFileSizeMB && file.size > maxFileSizeMB * 1024 * 1024) {
    const fileSizeGB = (file.size / (1024 * 1024 * 1024)).toFixed(1);
    const limitGB = (maxFileSizeMB / 1024).toFixed(0);
    return { valid: false, error: `File too large (${fileSizeGB} GB). Maximum: ${limitGB} GB. Adjust in Global Settings.` };
  }

  return { valid: true };
}

/**
 * Prepare FormData for video upload
 */
export function prepareUploadFormData(
  file: File,
  options: {
    secondaryLanguage?: string;
    model?: string;
    reprocess?: boolean;
    existingFileUri?: string;
    /** Lets the page cancel this upload via /api/process/cancel */
    uploadId?: string;
  } = {}
): FormData {
  const formData = new FormData();
  formData.append('video', file);

  if (options.uploadId) {
    formData.append('uploadId', options.uploadId);
  }

  if (options.secondaryLanguage) {
    formData.append('secondaryLanguage', options.secondaryLanguage);
  }
  
  if (options.model) {
    formData.append('model', options.model);
  }
  
  if (options.reprocess) {
    formData.append('reprocess', 'true');
  }
  
  if (options.existingFileUri) {
    formData.append('existingFileUri', options.existingFileUri);
  }

  return formData;
}

const MEDIA_TYPES_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
  mov: 'video/quicktime', avi: 'video/x-msvideo', mpeg: 'video/mpeg', mpg: 'video/mpeg',
  ogv: 'video/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav',
  ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac',
};

/**
 * The upload's media type, falling back to its extension when the browser
 * didn't name one (some send "" or application/octet-stream for .mkv and
 * others, which Gemini rejects).
 */
export function resolveMediaMimeType(filename: string, declared: string | undefined): string {
  if (declared && /^(video|audio)\//.test(declared)) return declared;
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MEDIA_TYPES_BY_EXTENSION[ext] ?? declared ?? 'application/octet-stream';
}

/**
 * Message for an upload whose connection dropped (phone asleep, Wi-Fi lost).
 * Once the server has the whole file it keeps processing and saves the result
 * to Drafts by itself.
 */
export function describeLostConnection(uploadFinished: boolean): string {
  return uploadFinished
    ? 'Lost connection to the server after the upload finished. Processing continues on the server, and the result will appear in Drafts.'
    : 'Lost connection to the server during the upload. Please try again.';
}

/**
 * Generate a unique clip ID
 */
export function generateClipId(): string {
  // Use crypto.randomUUID if available, otherwise fallback to Date.now
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse video processing response
 */
export interface ProcessingResponse {
  subtitles: Array<{
    startTime: string;
    endTime: string;
    text: string;
    secondaryText?: string;
  }>;
  videoPath: string;
  detectedLanguage?: string;
  geminiFileUri?: string;
}

export function isValidProcessingResponse(data: unknown): data is ProcessingResponse {
  if (!data || typeof data !== 'object') return false;
  const resp = data as Record<string, unknown>;
  return (
    Array.isArray(resp.subtitles) &&
    typeof resp.videoPath === 'string'
  );
}
