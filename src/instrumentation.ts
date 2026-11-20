/**
 * Runs once when the Next.js server starts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Node's fetch gives up if response headers take longer than 5 minutes.
  // Gemini sends nothing until it has finished a non-streaming request, and
  // transcribing long videos can take longer than that, so every such request
  // failed at exactly 300 s with "fetch failed". Gemini calls set their own
  // deadlines (see GEMINI_REQUEST_TIMEOUT_MS); this only lifts Node's ceiling.
  const { Agent, setGlobalDispatcher } = await import('undici');
  const { FETCH_TIMEOUT_MS } = await import('@/lib/gemini-timeouts');
  setGlobalDispatcher(new Agent({ headersTimeout: FETCH_TIMEOUT_MS, bodyTimeout: FETCH_TIMEOUT_MS }));
}
