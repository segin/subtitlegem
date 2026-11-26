/**
 * Resumable uploads (server side).
 *
 * The browser sends a file in pieces, which are appended to
 * {STAGING_DIR}/temp/uploads/<id>.part. When the connection drops (phone
 * asleep, Wi-Fi lost, page reloaded), the browser asks how much arrived and
 * carries on from there. Starting an upload of the same file again (same
 * name, size and modification time) picks up the unfinished one, so a
 * reloaded page can continue by selecting the file again.
 *
 * How much has arrived is simply the size of the .part file: pieces are only
 * written once fully received, in order, under a per-upload lock, so the file
 * is always a correct prefix of the original, even after a crash mid-write.
 */
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getStorageConfig } from "./storage-config";
import { isSafeId } from "./path-utils";
import { secureDelete } from "./security";
import { resolveMediaMimeType } from "./upload-utils";

/** Largest piece accepted in one request (the browser sends 8 MB) */
export const MAX_CHUNK_BYTES = 16 * 1024 * 1024;
/** Unfinished uploads untouched for this long are deleted */
export const UPLOAD_SESSION_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export interface UploadSessionInfo {
  filename: string;
  size: number;
  mimeType: string;
  /** File.lastModified, used with name and size to recognise the same file again */
  lastModified: number;
}

interface UploadSessionMeta extends UploadSessionInfo {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface UploadSessionStatus extends UploadSessionMeta {
  /** Bytes stored so far */
  received: number;
}

export interface CompletedUpload {
  path: string;
  filename: string;
  mimeType: string;
  size: number;
}

/** An upload request that can't be honoured; `status` is the HTTP status to answer with */
export class UploadSessionError extends Error {
  constructor(message: string, public status: number, public received?: number) {
    super(message);
    this.name = "UploadSessionError";
  }
}

const uploadsDir = () => path.join(getStorageConfig().stagingDir, "temp", "uploads");
const partPath = (id: string) => path.join(uploadsDir(), `${id}.part`);
const metaPath = (id: string) => path.join(uploadsDir(), `${id}.json`);

// Writes to one upload happen one at a time. A piece is read off the network
// before taking the lock, so a stalled request never blocks a retry.
const locks = new Map<string, Promise<unknown>>();
async function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  locks.set(id, run);
  try {
    return await run;
  } finally {
    if (locks.get(id) === run) locks.delete(id);
  }
}

async function readMeta(id: string): Promise<UploadSessionMeta | null> {
  if (!isSafeId(id)) return null;
  try {
    return JSON.parse(await fs.promises.readFile(metaPath(id), "utf8")) as UploadSessionMeta;
  } catch {
    return null;
  }
}

async function writeMeta(meta: UploadSessionMeta): Promise<void> {
  const tmp = `${metaPath(meta.id)}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(meta));
  await fs.promises.rename(tmp, metaPath(meta.id));
}

async function receivedBytes(id: string): Promise<number> {
  try {
    return (await fs.promises.stat(partPath(id))).size;
  } catch {
    return 0;
  }
}

async function removeSession(id: string): Promise<void> {
  await secureDelete(partPath(id)).catch(() => undefined);
  await fs.promises.rm(metaPath(id), { force: true });
}

export async function getUploadSession(id: string): Promise<UploadSessionStatus | null> {
  const meta = await readMeta(id);
  return meta ? { ...meta, received: await receivedBytes(id) } : null;
}

/** Deletes uploads nobody has touched for UPLOAD_SESSION_MAX_AGE_MS */
export async function pruneUploadSessions(now = Date.now()): Promise<number> {
  let removed = 0;
  let names: string[];
  try {
    names = await fs.promises.readdir(uploadsDir());
  } catch {
    return 0;
  }
  for (const name of names) {
    const match = /^(.+)\.(json|part)$/.exec(name);
    if (!match || !isSafeId(match[1])) continue;
    const id = match[1];
    const meta = await readMeta(id);
    let lastTouched = meta?.updatedAt;
    if (lastTouched === undefined) {
      // A .part without its .json (e.g. a crash between the two writes)
      lastTouched = await fs.promises.stat(path.join(uploadsDir(), name)).then(s => s.mtimeMs).catch(() => now);
    }
    if (now - lastTouched > UPLOAD_SESSION_MAX_AGE_MS) {
      await removeSession(id);
      removed++;
    }
  }
  return removed;
}

/**
 * Starts an upload, or returns the unfinished (or finished but not yet
 * processed) upload of the same file so the browser can continue it.
 */
export async function startUploadSession(info: UploadSessionInfo): Promise<UploadSessionStatus> {
  const filename = path.basename(info.filename).slice(0, 255);
  await fs.promises.mkdir(uploadsDir(), { recursive: true });
  await pruneUploadSessions();

  for (const name of await fs.promises.readdir(uploadsDir())) {
    if (!name.endsWith(".json")) continue;
    const existing = await getUploadSession(name.slice(0, -".json".length));
    if (
      existing &&
      existing.filename === filename &&
      existing.size === info.size &&
      existing.lastModified === info.lastModified &&
      existing.received <= existing.size
    ) {
      return existing;
    }
  }

  const now = Date.now();
  const meta: UploadSessionMeta = {
    id: randomUUID(),
    filename,
    size: info.size,
    mimeType: info.mimeType,
    lastModified: info.lastModified,
    createdAt: now,
    updatedAt: now,
  };
  await fs.promises.writeFile(partPath(meta.id), "");
  await writeMeta(meta);
  return { ...meta, received: 0 };
}

/** Appends the piece that starts at `offset`; answers 409 with the right offset if that's not where the file ends */
export async function appendUploadChunk(id: string, offset: number, data: Buffer): Promise<UploadSessionStatus> {
  return withLock(id, async () => {
    const meta = await readMeta(id);
    if (!meta) throw new UploadSessionError("Upload not found. It may have expired; please upload the file again.", 404);

    const received = await receivedBytes(id);
    if (offset !== received) {
      throw new UploadSessionError(`Expected the piece at byte ${received}`, 409, received);
    }
    if (offset + data.length > meta.size) {
      throw new UploadSessionError("This piece goes past the end of the file", 400, received);
    }

    await fs.promises.appendFile(partPath(id), data);
    const updated = { ...meta, updatedAt: Date.now() };
    await writeMeta(updated);
    return { ...updated, received: received + data.length };
  });
}

/**
 * Hands over a fully received upload for processing: the file moves out of
 * the uploads folder (so it can't be taken twice) and the upload is closed.
 */
export async function takeCompletedUpload(id: string): Promise<CompletedUpload> {
  return withLock(id, async () => {
    const meta = await readMeta(id);
    if (!meta) throw new UploadSessionError("Upload not found. It may already be processing, or it expired.", 404);

    const received = await receivedBytes(id);
    if (received !== meta.size) {
      throw new UploadSessionError(`The upload is incomplete (${received} of ${meta.size} bytes)`, 409, received);
    }

    const ext = meta.filename.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "tmp";
    const destination = path.join(getStorageConfig().stagingDir, "temp", `${randomUUID()}.${ext}`);
    await fs.promises.rename(partPath(id), destination);
    await fs.promises.rm(metaPath(id), { force: true });

    return {
      path: destination,
      filename: meta.filename,
      mimeType: resolveMediaMimeType(meta.filename, meta.mimeType),
      size: meta.size,
    };
  });
}

/** Cancels an upload and deletes what arrived */
export async function deleteUploadSession(id: string): Promise<boolean> {
  return withLock(id, async () => {
    if (!(await readMeta(id))) return false;
    await removeSession(id);
    return true;
  });
}
