/**
 * @jest-environment node
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-sessions-'));
jest.mock('./storage-config', () => ({ getStorageConfig: () => ({ stagingDir: staging }) }));

import {
  appendUploadChunk,
  deleteUploadSession,
  getUploadSession,
  pruneUploadSessions,
  startUploadSession,
  takeCompletedUpload,
  UPLOAD_SESSION_MAX_AGE_MS,
  UploadSessionError,
} from './upload-sessions';

const info = { filename: 'holiday.mp4', size: 10, mimeType: 'video/mp4', lastModified: 1700000000000 };
const bytes = (s: string) => Buffer.from(s);
const uploadsDir = path.join(staging, 'temp', 'uploads');

afterAll(() => fs.rmSync(staging, { recursive: true, force: true }));
beforeEach(() => fs.rmSync(path.join(staging, 'temp'), { recursive: true, force: true }));

const errorOf = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return e as UploadSessionError; }
  throw new Error('expected an error');
};

describe('upload sessions', () => {
  test('pieces are appended in order and the finished file is handed over once', async () => {
    const s = await startUploadSession(info);
    expect(s.received).toBe(0);
    expect((await appendUploadChunk(s.id, 0, bytes('01234'))).received).toBe(5);
    expect((await appendUploadChunk(s.id, 5, bytes('56789'))).received).toBe(10);

    const done = await takeCompletedUpload(s.id);
    expect(fs.readFileSync(done.path, 'utf8')).toBe('0123456789');
    expect(path.dirname(done.path)).toBe(path.join(staging, 'temp'));
    expect(done).toMatchObject({ filename: 'holiday.mp4', mimeType: 'video/mp4', size: 10 });
    expect(await getUploadSession(s.id)).toBeNull();
    expect((await errorOf(takeCompletedUpload(s.id))).status).toBe(404);
  });

  test('a piece at the wrong offset is refused with the right one (409)', async () => {
    const s = await startUploadSession(info);
    await appendUploadChunk(s.id, 0, bytes('012'));
    const resent = await errorOf(appendUploadChunk(s.id, 0, bytes('012')));
    expect(resent).toMatchObject({ status: 409, received: 3 });
    expect((await getUploadSession(s.id))?.received).toBe(3);
  });

  test('refuses pieces past the end, unknown uploads and unfinished hand-overs', async () => {
    const s = await startUploadSession(info);
    expect((await errorOf(appendUploadChunk(s.id, 0, bytes('0123456789X')))).status).toBe(400);
    expect((await errorOf(appendUploadChunk('nope', 0, bytes('0')))).status).toBe(404);
    expect((await errorOf(appendUploadChunk('../etc', 0, bytes('0')))).status).toBe(404);
    await appendUploadChunk(s.id, 0, bytes('01234'));
    expect(await errorOf(takeCompletedUpload(s.id))).toMatchObject({ status: 409, received: 5 });
  });

  test('the same file (name, size, date) resumes; a different one starts afresh', async () => {
    const first = await startUploadSession(info);
    await appendUploadChunk(first.id, 0, bytes('0123'));
    const again = await startUploadSession(info);
    expect(again).toMatchObject({ id: first.id, received: 4 });
    const other = await startUploadSession({ ...info, lastModified: info.lastModified + 1 });
    expect(other.id).not.toBe(first.id);
    expect(other.received).toBe(0);
  });

  test('pieces sent at the same time are written one after another', async () => {
    const s = await startUploadSession(info);
    const results = await Promise.allSettled([
      appendUploadChunk(s.id, 0, bytes('01234')),
      appendUploadChunk(s.id, 0, bytes('01234')), // a retry racing the original
      appendUploadChunk(s.id, 5, bytes('56789')),
    ]);
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect(fs.readFileSync(path.join(uploadsDir, `${s.id}.part`), 'utf8')).toBe('0123456789');
  });

  test('cancelling deletes what arrived', async () => {
    const s = await startUploadSession(info);
    await appendUploadChunk(s.id, 0, bytes('01'));
    expect(await deleteUploadSession(s.id)).toBe(true);
    expect(fs.readdirSync(uploadsDir)).toEqual([]);
    expect(await deleteUploadSession(s.id)).toBe(false);
  });

  test('uploads untouched for 48 hours are pruned', async () => {
    const old = await startUploadSession(info);
    const fresh = await startUploadSession({ ...info, filename: 'other.mp4' });
    expect(await pruneUploadSessions(Date.now() + UPLOAD_SESSION_MAX_AGE_MS / 2)).toBe(0);
    await appendUploadChunk(fresh.id, 0, bytes('0')); // touched later
    const meta = JSON.parse(fs.readFileSync(path.join(uploadsDir, `${fresh.id}.json`), 'utf8'));
    fs.writeFileSync(path.join(uploadsDir, `${fresh.id}.json`), JSON.stringify({ ...meta, updatedAt: meta.updatedAt + UPLOAD_SESSION_MAX_AGE_MS }));

    expect(await pruneUploadSessions(Date.now() + UPLOAD_SESSION_MAX_AGE_MS + 1000)).toBe(1);
    expect(await getUploadSession(old.id)).toBeNull();
    expect(await getUploadSession(fresh.id)).not.toBeNull();
  });

  test('file names are reduced to their base name', async () => {
    const s = await startUploadSession({ ...info, filename: '../../etc/passwd.mp4' });
    expect(s.filename).toBe('passwd.mp4');
  });
});
