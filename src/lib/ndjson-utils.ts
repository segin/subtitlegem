/**
 * Incremental reader for newline-delimited JSON that arrives in chunks, such as
 * an XHR's growing responseText while readyState is 3.
 *
 * An incomplete trailing line is kept in a buffer until the rest of it arrives,
 * so a large message split across chunks (e.g. the final "complete" message
 * carrying every subtitle) is parsed once instead of being dropped.
 */
export interface NdjsonReader {
  /** Feed the full response text received so far; new complete lines are emitted. */
  push(fullText: string): void;
  /** Call once the response has fully arrived, to flush a final line without a trailing newline. */
  end(): void;
}

export function createNdjsonReader(onMessage: (message: unknown) => void): NdjsonReader {
  let consumed = 0;
  let buffer = "";

  const emit = (line: string) => {
    if (!line.trim()) return;
    try {
      onMessage(JSON.parse(line));
    } catch {
      console.error("[NDJSON] Skipping malformed line:", line.slice(0, 200));
    }
  };

  return {
    push(fullText: string) {
      buffer += fullText.substring(consumed);
      consumed = fullText.length;

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      lines.forEach(emit);
    },
    end() {
      emit(buffer);
      buffer = "";
    },
  };
}

/** Message text for a streamed request that ended without a "complete" or "error" message. */
export function describeIncompleteStream(status: number, lastMessage: unknown): string {
  const serverError = (lastMessage as { error?: unknown } | null)?.error;
  if (typeof serverError === "string" && serverError) return serverError;
  if (status >= 400) return `Upload failed (HTTP ${status})`;
  return "Server closed the connection before processing finished";
}
