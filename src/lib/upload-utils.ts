/**
 * Upload utilities for file validation and processing
 */

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

// Maximum file size: 2GB
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

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
 */
export function validateVideoFile(file: File): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large. Maximum size is 2GB.` };
  }

  if (!ALLOWED_VIDEO_TYPES.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|avi|mkv|mpeg|ogv)$/i)) {
    return { valid: false, error: 'Unsupported video format' };
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
  } = {}
): FormData {
  const formData = new FormData();
  formData.append('video', file);
  
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
