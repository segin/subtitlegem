/**
 * Error handling utilities for API routes
 * Prevents leaking implementation details in production
 */

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Safe error response that hides implementation details in production
 */
export interface SafeErrorResponse {
  error: string;
  details?: string;
}

/**
 * Create a safe error response for API routes
 * In production, hides detailed error messages
 * In development, includes full error details
 */
export function createSafeErrorResponse(
  error: Error | unknown,
  publicMessage: string = 'An error occurred'
): SafeErrorResponse {
  const err = error instanceof Error ? error : new Error(String(error));
  
  if (isProduction()) {
    // Production: only return public message, log details server-side
    console.error(`[API Error] ${publicMessage}:`, err.message, err.stack);
    return { error: publicMessage };
  }
  
  // Development: return full details for debugging
  return {
    error: publicMessage,
    details: err.message
  };
}

/**
 * One-line description of an error for server logs, including its cause chain.
 * Node's fetch reports every network failure as "fetch failed"; the real reason
 * (timeout, DNS, reset) only appears in `cause`.
 *
 * e.g. "TypeError: fetch failed ← HeadersTimeoutError: Headers Timeout Error [UND_ERR_HEADERS_TIMEOUT]"
 */
export function describeError(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current !== undefined && current !== null && !seen.has(current) && parts.length < 5) {
    seen.add(current);
    if (current instanceof Error) {
      const code = (current as { code?: unknown }).code;
      const status = (current as { status?: unknown }).status;
      let part = `${current.name}: ${current.message}`;
      if (typeof code === 'string' || typeof code === 'number') part += ` [${code}]`;
      if (typeof status === 'number') part += ` (HTTP ${status})`;
      parts.push(part);
      current = (current as { cause?: unknown }).cause;
    } else {
      parts.push(typeof current === 'string' ? current : JSON.stringify(current) ?? String(current));
      break;
    }
  }

  return parts.join(' ← ') || String(error);
}

/**
 * HTTP status code suggestions based on error type
 */
export function suggestHttpStatus(error: Error | unknown): number {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  
  if (message.includes('not found') || message.includes('does not exist')) {
    return 404;
  }
  if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('access denied')) {
    return 403;
  }
  if (message.includes('invalid') || message.includes('must be') || message.includes('required')) {
    return 400;
  }
  if (message.includes('too many') || message.includes('rate limit') || message.includes('exceeded')) {
    return 429;
  }
  
  return 500;
}

/**
 * Wrapper to handle errors in API route handlers
 */
export function withSafeErrorHandling<T>(
  handler: () => Promise<T>,
  publicMessage: string = 'Request processing failed'
): Promise<{ success: true; result: T } | { success: false; error: SafeErrorResponse; status: number }> {
  return handler()
    .then(result => ({ success: true as const, result }))
    .catch((error: Error) => ({
      success: false as const,
      error: createSafeErrorResponse(error, publicMessage),
      status: suggestHttpStatus(error)
    }));
}
