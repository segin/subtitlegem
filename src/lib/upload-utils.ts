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
