/**
 * @jest-environment node
 */
import { describeStoppedUpload, HttpResult, startResumableUpload, UPLOAD_CHUNK_BYTES, UploadTransport } from './upload-client';

const MB = 1024 * 1024;

/** An in-memory /api/upload + /api/process, with switches to drop connections */
function fakeServer() {
  const sessions = new Map<string, { name: string; size: number; lastModified: number; data: Uint8Array[]; received: number }>();
  const log: string[] = [];
  let clock = 0;
  let nextId = 1;
  const json = (status: number, body: unknown): HttpResult => ({ status, body: JSON.stringify(body) });
  const server = {
    sessions,
    log,
    /** PUT numbers (1-based) whose connection drops before the server gets the piece */
    dropBefore: new Set<number>(),
    /** PUT numbers whose reply is lost after the server stored the piece */
    dropReply: new Set<number>(),
    /** Every request fails as if offline */
    offline: false,
    processingReplies: [] as ('drop' | 'ok' | 'gone')[],
    puts: 0,
    processedId: null as string | null,
  };

  const transport: UploadTransport = {
    async request(method, url, body, { onUploadProgress }) {
      const u = new URL(url, 'http://x');
      log.push(`${method} ${u.pathname}${u.search}`);
      if (server.offline) return { status: 0, body: '' };
      const id = u.searchParams.get('id') ?? '';
      if (method === 'POST') {
        const info = JSON.parse(body as string);
        for (const [sid, s] of sessions) {
          if (s.name === info.filename && s.size === info.size && s.lastModified === info.lastModified) {
            return json(200, { id: sid, received: s.received, size: s.size });
          }
        }
        const sid = `s${nextId++}`;
        sessions.set(sid, { name: info.filename, size: info.size, lastModified: info.lastModified, data: [], received: 0 });
        return json(200, { id: sid, received: 0, size: info.size });
      }
      const session = sessions.get(id);
      if (!session) return json(404, { error: 'Upload not found' });
      if (method === 'GET') return json(200, { id, received: session.received, size: session.size });
      if (method === 'DELETE') { sessions.delete(id); return json(200, { deleted: true }); }
      if (method === 'PUT') {
        const n = ++server.puts;
        if (server.dropBefore.has(n)) return { status: 0, body: '' };
        const offset = Number(u.searchParams.get('offset'));
        if (offset !== session.received) return json(409, { error: 'wrong offset', received: session.received });
        const bytes = new Uint8Array(await (body as Blob).arrayBuffer());
        onUploadProgress?.(bytes.length);
        session.data.push(bytes);
        session.received += bytes.length;
        if (server.dropReply.has(n)) return { status: 0, body: '' };
        return json(200, { id, received: session.received, size: session.size });
      }
      throw new Error(`unexpected ${method}`);
    },
    async stream(url, body, onMessage) {
      log.push(`POST ${url} ${body}`);
      const reply = server.processingReplies.shift() ?? 'ok';
      const { uploadId } = JSON.parse(body);
      if (reply === 'drop') {
        // The request reached the server (which takes the file) but no reply came back
        sessions.delete(uploadId);
        server.processedId = uploadId;
        return { status: 0, body: '' };
      }
      if (!sessions.has(uploadId)) return json(404, { error: 'Upload not found' });
      const s = sessions.get(uploadId)!;
      if (s.received !== s.size) return json(409, { error: 'incomplete' });
      sessions.delete(uploadId);
      server.processedId = uploadId;
      onMessage({ type: 'progress', stage: 'generating_subtitles' });
      onMessage({ type: 'complete', data: { videoPath: `/stored/${s.name}`, subtitles: [] } });
      return { status: 200, body: '' };
    },
    async sleep(ms) { clock += ms; },
    now: () => clock,
  };
  return { server, transport, advance: (ms: number) => { clock += ms; } };
}

const makeFile = (size: number, name = 'clip.mp4') =>
  new File([new Uint8Array(size).map((_, i) => i % 251)], name, { type: 'video/mp4', lastModified: 1700000000000 });

const run = (file: File, transport: UploadTransport, extra: Partial<Parameters<typeof startResumableUpload>[2]> = {}) => {
  const messages: unknown[] = [];
  const progress: number[] = [];
  const reconnects: number[] = [];
  const job = startResumableUpload(file, { secondaryLanguage: 'English', model: 'gemini-3.8-flash' }, {
    onMessage: m => messages.push(m),
    onUploadProgress: loaded => progress.push(loaded),
    onReconnecting: received => reconnects.push(received),
    ...extra,
  }, transport);
  return { job, messages, progress, reconnects };
};

const stored = (server: ReturnType<typeof fakeServer>['server'], id: string) =>
  Buffer.concat(server.sessions.get(id)?.data.map(d => Buffer.from(d)) ?? []);

describe('startResumableUpload', () => {
  test('sends the file in 8 MB pieces, then asks the server to process it', async () => {
    const { server, transport } = fakeServer();
    const file = makeFile(20 * MB);
    const { job, messages, progress } = run(file, transport);
    const outcome = await job.done;

    expect(outcome).toMatchObject({ status: 200, uploadFinished: true, aborted: false });
    expect(server.log.filter(l => l.startsWith('PUT'))).toEqual([
      'PUT /api/upload?id=s1&offset=0',
      `PUT /api/upload?id=s1&offset=${UPLOAD_CHUNK_BYTES}`,
      `PUT /api/upload?id=s1&offset=${2 * UPLOAD_CHUNK_BYTES}`,
    ]);
    expect(server.log.at(-1)).toBe('POST /api/process {"mode":"uploaded","uploadId":"s1","secondaryLanguage":"English","model":"gemini-3.8-flash"}');
    expect(messages.at(-1)).toMatchObject({ type: 'complete' });
    expect(progress.at(-1)).toBe(file.size);
    expect(job.uploadId).toBe('s1');
  });

  test('a dropped piece is resent after reconnecting, and the file arrives intact', async () => {
    const { server, transport } = fakeServer();
    server.dropBefore.add(2);
    const file = makeFile(20 * MB);
    let bytes: Buffer | null = null;
    const original = transport.stream;
    transport.stream = async (...args) => { bytes = stored(server, 's1'); return original(...args); };

    const { job, reconnects } = run(file, transport);
    const outcome = await job.done;

    expect(outcome.status).toBe(200);
    expect(reconnects).toEqual([UPLOAD_CHUNK_BYTES]);
    expect(bytes!.equals(Buffer.from(await file.arrayBuffer()))).toBe(true);
  });

  test('when only the reply was lost, it asks where the server got to instead of resending', async () => {
    const { server, transport } = fakeServer();
    server.dropReply.add(1);
    const { job } = run(makeFile(12 * MB), transport);
    await job.done;

    const puts = server.log.filter(l => l.startsWith('PUT'));
    expect(puts).toEqual(['PUT /api/upload?id=s1&offset=0', `PUT /api/upload?id=s1&offset=${UPLOAD_CHUNK_BYTES}`]);
    expect(server.log).toContain('GET /api/upload?id=s1');
  });

  test('selecting the same file again continues an unfinished upload', async () => {
    const { server, transport } = fakeServer();
    const file = makeFile(20 * MB);
    // An earlier attempt stored the first piece and then the page went away
    server.sessions.set('s9', { name: file.name, size: file.size, lastModified: file.lastModified, data: [new Uint8Array(await file.slice(0, UPLOAD_CHUNK_BYTES).arrayBuffer())], received: UPLOAD_CHUNK_BYTES });

    const { job, progress } = run(file, transport);
    await job.done;

    expect(progress[0]).toBe(UPLOAD_CHUNK_BYTES);
    expect(server.log.filter(l => l.startsWith('PUT'))[0]).toBe(`PUT /api/upload?id=s9&offset=${UPLOAD_CHUNK_BYTES}`);
    expect(server.processedId).toBe('s9');
  });

  test('gives up after 30 minutes offline, saying how to continue', async () => {
    const { server, transport } = fakeServer();
    server.dropBefore.add(2);
    const original = transport.request;
    transport.request = async (method, url, body, options) => {
      if (server.puts >= 2) server.offline = true; // the network never comes back
      return original(method, url, body, options);
    };

    const file = makeFile(20 * MB);
    const outcome = await run(file, transport).job.done;

    expect(outcome.uploadFinished).toBe(false);
    expect(outcome.uploadError).toBe(describeStoppedUpload(UPLOAD_CHUNK_BYTES, file.size));
    expect(outcome.uploadError).toContain('lost at 40%');
    expect(server.sessions.get('s1')?.received).toBe(UPLOAD_CHUNK_BYTES); // kept for a later resume
  });

  test('a rejected file (e.g. too large) fails at once without retrying', async () => {
    const { transport } = fakeServer();
    transport.request = jest.fn(async () => ({ status: 413, body: JSON.stringify({ error: 'File too large. Maximum allowed: 10 MB.' }) }));
    const outcome = await run(makeFile(MB), transport).job.done;
    expect(outcome.uploadError).toBe('File too large. Maximum allowed: 10 MB.');
    expect(transport.request).toHaveBeenCalledTimes(1);
  });

  test('cancelling mid-upload stops and deletes the partial file on the server', async () => {
    const { server, transport } = fakeServer();
    let job: ReturnType<typeof startResumableUpload> | null = null;
    const original = transport.request;
    transport.request = async (method, url, body, options) => {
      const res = await original(method, url, body, options);
      if (method === 'PUT') job!.abort();
      return res;
    };
    job = run(makeFile(20 * MB), transport).job;
    const outcome = await job.done;

    expect(outcome).toMatchObject({ aborted: true, uploadFinished: false });
    await new Promise(r => setTimeout(r, 0));
    expect(server.log).toContain('DELETE /api/upload?id=s1');
    expect(server.sessions.has('s1')).toBe(false);
  });

  test('if the processing request got no reply, it is sent again', async () => {
    const { server, transport } = fakeServer();
    server.processingReplies = ['drop'];
    const outcome = await run(makeFile(MB), transport).job.done;
    // The retry found the file already taken: the server is processing it
    expect(outcome).toMatchObject({ status: 0, uploadFinished: true, aborted: false });
    expect(server.log.filter(l => l.startsWith('POST /api/process'))).toHaveLength(2);
  });

  test('a JSON error from processing is passed on as the last message', async () => {
    const { transport } = fakeServer();
    transport.stream = async () => ({ status: 400, body: JSON.stringify({ error: 'Invalid secondary language' }) });
    const outcome = await run(makeFile(MB), transport).job.done;
    expect(outcome.status).toBe(400);
    expect(outcome.lastMessage).toEqual({ error: 'Invalid secondary language' });
  });
});

describe('describeStoppedUpload', () => {
  test('explains how to continue', () => {
    expect(describeStoppedUpload(0, 100)).toMatch(/Couldn't reach the server/);
    expect(describeStoppedUpload(55, 100)).toMatch(/lost at 55%.*Select the same file/);
  });
});
