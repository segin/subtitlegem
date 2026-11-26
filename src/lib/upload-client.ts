/**
 * Uploads a video in resumable pieces, then has the server transcribe it
 * (browser side; the server side is src/lib/upload-sessions.ts).
 *
 * The file goes up in 8 MB pieces. If the connection drops (phone asleep,
 * Wi-Fi lost, server restarted), the upload keeps retrying, asks the server
 * how much it has, and continues from there instead of starting over. If it
 * gives up, or the page is closed, selecting the same file again continues
 * where it stopped (the server keeps unfinished uploads for 48 hours).
 *
 * Once the whole file is on the server, POST /api/process {mode: "uploaded"}
 * transcribes it and streams progress as NDJSON, as the single-request upload
 * did.
 */
import { createNdjsonReader, describeIncompleteStream } from "./ndjson-utils";
import { describeLostConnection } from "./upload-utils";

export const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
/** A piece that makes no progress for this long is abandoned and retried */
const STALL_TIMEOUT_MS = 60_000;
/** How long to keep retrying a dropped connection before giving up */
const GIVE_UP_AFTER_MS = 30 * 60_000;
const retryDelay = (attempt: number) => Math.min(15_000, 1000 * 2 ** attempt);

export interface HttpResult {
  /** 0 when the request failed without a response (network error, stall) */
  status: number;
  body: string;
}

export interface UploadTransport {
  /** Sends a request; onUploadProgress reports bytes of `body` sent so far */
  request(
    method: string,
    url: string,
    body: Blob | string | null,
    options: { signal: AbortSignal; onUploadProgress?: (sent: number) => void },
  ): Promise<HttpResult>;
  /** POSTs JSON and feeds each NDJSON line of the (streamed) response to onMessage */
  stream(url: string, body: string, onMessage: (message: unknown) => void, signal: AbortSignal): Promise<HttpResult>;
  sleep(ms: number, signal: AbortSignal): Promise<void>;
  now(): number;
}

export interface UploadCallbacks {
  /** Bytes of the file on the server (including pieces sent before a resume) */
  onUploadProgress?: (loaded: number, total: number) => void;
  /** The whole file is on the server; transcription starts */
  onUploadComplete?: () => void;
  /** The connection dropped; retrying. `received` is what the server already has. */
  onReconnecting?: (received: number, total: number) => void;
  /** Each NDJSON message from processing ({type: "progress" | "complete" | "error", ...}) */
  onMessage: (message: unknown) => void;
}

export interface UploadOutcome {
  /** HTTP status of the processing request; 0 if it ended without a response */
  status: number;
  /** Last processing message received */
  lastMessage: unknown;
  /** The whole file reached the server (it keeps processing even if this page goes away) */
  uploadFinished: boolean;
  /** Stopped by abort() */
  aborted: boolean;
  /** Why the upload failed, if it failed before processing started */
  uploadError?: string;
}

export interface UploadJob {
  /** The server's id for this upload, once known (Cancel reports it to /api/process/cancel) */
  readonly uploadId: string | null;
  /** Stops the job; an unfinished upload is deleted from the server */
  abort(): void;
  /** Resolves (never rejects) when processing ends or the upload fails */
  done: Promise<UploadOutcome>;
}

class AbortedError extends Error {}
class FatalUploadError extends Error {}

const parse = (body: string): Record<string, unknown> => {
  try {
    return JSON.parse(body) ?? {};
  } catch {
    return {};
  }
};

const percent = (received: number, total: number) => Math.floor((received / total) * 100);

/** Message for an upload that stopped before the whole file arrived */
export function describeStoppedUpload(received: number, total: number): string {
  return received > 0
    ? `The connection to the server was lost at ${percent(received, total)}% and didn't come back. ` +
      `Select the same file and upload again to continue from there.`
    : "Couldn't reach the server to upload the file. Check the connection and try again.";
}

/** What to tell the user when a job ended without a "complete" or "error" message */
export function describeUploadFailure(outcome: UploadOutcome): string {
  if (outcome.uploadError) return outcome.uploadError;
  if (outcome.status !== 0) return describeIncompleteStream(outcome.status, outcome.lastMessage);
  // The processing connection dropped; the server carries on and saves a draft
  return describeLostConnection(outcome.uploadFinished);
}

export function startResumableUpload(
  file: File,
  fields: { secondaryLanguage?: string; model?: string },
  callbacks: UploadCallbacks,
  transport: UploadTransport = browserTransport,
): UploadJob {
  const controller = new AbortController();
  const { signal } = controller;
  let uploadId: string | null = null;
  let uploadFinished = false;
  let lastMessage: unknown = null;
  let processingResponded = false;

  const check = () => {
    if (signal.aborted) throw new AbortedError();
  };

  /** Runs `attempt` until it succeeds, retrying network failures and 5xx/408/429 with backoff */
  const withRetries = async <T>(attempt: () => Promise<T | "retry">, received: () => number): Promise<T> => {
    let failingSince: number | null = null;
    for (let tries = 0; ; tries++) {
      check();
      const result = await attempt();
      if (result !== "retry") return result;
      check();
      failingSince ??= transport.now();
      if (transport.now() - failingSince > GIVE_UP_AFTER_MS) {
        throw new FatalUploadError(describeStoppedUpload(received(), file.size));
      }
      callbacks.onReconnecting?.(received(), file.size);
      await transport.sleep(retryDelay(Math.min(tries, 4)), signal);
    }
  };

  const isRetryable = (status: number) => status === 0 || status === 408 || status === 429 || status >= 500;
  const failure = (res: HttpResult, fallback: string) =>
    new FatalUploadError((parse(res.body).error as string) || `${fallback} (HTTP ${res.status})`);

  const upload = async (): Promise<void> => {
    let received = 0;

    const session = await withRetries(async () => {
      const res = await transport.request("POST", "/api/upload", JSON.stringify({
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        lastModified: file.lastModified,
      }), { signal });
      if (res.status === 200) return parse(res.body);
      if (isRetryable(res.status)) return "retry";
      throw failure(res, "Upload failed");
    }, () => received);

    uploadId = String(session.id);
    received = Number(session.received) || 0;
    callbacks.onUploadProgress?.(received, file.size);

    while (received < file.size) {
      const offset = received;
      const piece = file.slice(offset, Math.min(file.size, offset + UPLOAD_CHUNK_BYTES));
      received = await withRetries(async () => {
        const res = await transport.request("PUT", `/api/upload?id=${encodeURIComponent(uploadId!)}&offset=${offset}`, piece, {
          signal,
          onUploadProgress: sent => callbacks.onUploadProgress?.(offset + sent, file.size),
        });
        // 409: the server has a different amount than we thought; carry on from there
        if (res.status === 200 || res.status === 409) {
          const now = Number(parse(res.body).received);
          if (Number.isFinite(now)) return now;
        }
        if (res.status === 404) throw failure(res, "The upload expired on the server");
        if (isRetryable(res.status)) {
          // After a drop, ask where the server got to before resending
          const where = await transport.request("GET", `/api/upload?id=${encodeURIComponent(uploadId!)}`, null, { signal });
          if (where.status === 404) throw failure(where, "The upload expired on the server");
          const now = Number(parse(where.body).received);
          if (where.status === 200 && Number.isFinite(now) && now !== offset) return now;
          return "retry";
        }
        throw failure(res, "Upload failed");
      }, () => received);
      callbacks.onUploadProgress?.(received, file.size);
    }

    uploadFinished = true;
    callbacks.onUploadComplete?.();
  };

  const processUpload = async (): Promise<HttpResult> => {
    const body = JSON.stringify({ mode: "uploaded", uploadId, secondaryLanguage: fields.secondaryLanguage, model: fields.model });
    return withRetries(async () => {
      const res = await transport.stream("/api/process", body, message => {
        processingResponded = true;
        lastMessage = message;
        callbacks.onMessage(message);
      }, signal);
      // No reply at all: the request may never have reached the server, so ask again.
      // If it did, the file is already being processed and the retry gets 404.
      if (res.status === 0 && !processingResponded) return "retry";
      return res;
    }, () => file.size);
  };

  const done = (async (): Promise<UploadOutcome> => {
    try {
      await upload();
      const res = await processUpload();
      if (res.status === 404 && !processingResponded) {
        // An earlier attempt reached the server, which took the file and is processing it
        return { status: 0, lastMessage, uploadFinished, aborted: false };
      }
      // A plain JSON error (e.g. invalid language) instead of a stream: report its message
      if (res.status !== 200 && !processingResponded) lastMessage = parse(res.body);
      return { status: res.status, lastMessage, uploadFinished, aborted: false };
    } catch (error) {
      if (error instanceof AbortedError || signal.aborted) {
        return { status: 0, lastMessage, uploadFinished, aborted: true };
      }
      return {
        status: 0,
        lastMessage,
        uploadFinished,
        aborted: false,
        uploadError: error instanceof Error ? error.message : String(error),
      };
    }
  })();

  return {
    get uploadId() { return uploadId; },
    abort() {
      if (signal.aborted) return;
      controller.abort();
      if (uploadId && !uploadFinished) {
        // Don't keep half a file the user no longer wants
        transport.request("DELETE", `/api/upload?id=${encodeURIComponent(uploadId)}`, null, { signal: new AbortController().signal })
          .catch(() => undefined);
      }
    },
    done,
  };
}

/** XMLHttpRequest-based transport: upload progress events, stall detection, streamed responses */
export const browserTransport: UploadTransport = {
  request(method, url, body, { signal, onUploadProgress }) {
    return new Promise<HttpResult>((resolve, reject) => {
      if (signal.aborted) return reject(new AbortedError());
      const xhr = new XMLHttpRequest();
      let stallTimer: ReturnType<typeof setTimeout>;
      const finish = (result: HttpResult) => {
        clearTimeout(stallTimer);
        signal.removeEventListener("abort", onAbort);
        resolve(result);
      };
      // A sleeping phone can leave a request hanging instead of failing it
      const armStallTimer = () => {
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => { xhr.abort(); finish({ status: 0, body: "" }); }, STALL_TIMEOUT_MS);
      };
      const onAbort = () => {
        clearTimeout(stallTimer);
        xhr.abort();
        reject(new AbortedError());
      };
      signal.addEventListener("abort", onAbort);

      xhr.upload.onprogress = e => { armStallTimer(); onUploadProgress?.(e.loaded); };
      xhr.onload = () => finish({ status: xhr.status, body: xhr.responseText });
      xhr.onerror = () => finish({ status: 0, body: "" });
      xhr.open(method, url);
      if (typeof body === "string") xhr.setRequestHeader("Content-Type", "application/json");
      armStallTimer();
      xhr.send(body);
    });
  },

  stream(url, body, onMessage, signal) {
    return new Promise<HttpResult>((resolve, reject) => {
      if (signal.aborted) return reject(new AbortedError());
      const xhr = new XMLHttpRequest();
      const reader = createNdjsonReader(onMessage);
      const onAbort = () => { xhr.abort(); reject(new AbortedError()); };
      signal.addEventListener("abort", onAbort);

      xhr.onreadystatechange = () => {
        // Only a 200 is a stream of progress messages; anything else is a JSON error
        const streaming = xhr.status === 200;
        if (streaming && (xhr.readyState === 3 || xhr.readyState === 4)) reader.push(xhr.responseText);
        if (xhr.readyState === 4) {
          if (streaming) reader.end();
          signal.removeEventListener("abort", onAbort);
          // status 0: the connection dropped (or the request was aborted)
          resolve({ status: xhr.status, body: streaming ? "" : xhr.responseText });
        }
      };
      xhr.open("POST", url);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(body);
    });
  },

  sleep(ms, signal) {
    return new Promise<void>(resolve => {
      const timer = setTimeout(done, ms);
      // Retry right away when the browser reports the network is back
      const onOnline = () => done();
      function done() {
        clearTimeout(timer);
        window.removeEventListener("online", onOnline);
        signal.removeEventListener("abort", done);
        resolve();
      }
      window.addEventListener("online", onOnline);
      signal.addEventListener("abort", done);
    });
  },

  now: () => Date.now(),
};
