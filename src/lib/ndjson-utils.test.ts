import { createNdjsonReader, describeIncompleteStream } from './ndjson-utils';

describe('createNdjsonReader', () => {
  it('emits each complete line as it arrives', () => {
    const messages: unknown[] = [];
    const reader = createNdjsonReader(m => messages.push(m));

    let text = '{"type":"progress","percent":10}\n';
    reader.push(text);
    text += '{"type":"progress","percent":20}\n';
    reader.push(text);

    expect(messages).toEqual([
      { type: 'progress', percent: 10 },
      { type: 'progress', percent: 20 },
    ]);
  });

  it('buffers a message split across chunks instead of dropping it', () => {
    const messages: unknown[] = [];
    const reader = createNdjsonReader(m => messages.push(m));
    const complete = JSON.stringify({ type: 'complete', data: { subtitles: Array(50).fill({ text: 'line' }) } });

    let text = '{"type":"progress"}\n' + complete.slice(0, 40);
    reader.push(text);
    expect(messages).toHaveLength(1);

    text += complete.slice(40) + '\n';
    reader.push(text);

    expect(messages).toHaveLength(2);
    expect(messages[1]).toEqual(JSON.parse(complete));
  });

  it('flushes a final line without a trailing newline on end()', () => {
    const messages: unknown[] = [];
    const reader = createNdjsonReader(m => messages.push(m));

    reader.push('{"error":"Unauthorized"}');
    expect(messages).toHaveLength(0);
    reader.end();

    expect(messages).toEqual([{ error: 'Unauthorized' }]);
  });

  it('skips malformed lines and keeps going', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    const messages: unknown[] = [];
    const reader = createNdjsonReader(m => messages.push(m));

    reader.push('not json\n{"ok":1}\n');

    expect(messages).toEqual([{ ok: 1 }]);
    errorSpy.mockRestore();
  });
});

describe('describeIncompleteStream', () => {
  it('prefers a server-provided error message', () => {
    expect(describeIncompleteStream(401, { error: 'Unauthorized' })).toBe('Unauthorized');
  });

  it('reports the HTTP status for failed responses', () => {
    expect(describeIncompleteStream(413, null)).toBe('Upload failed (HTTP 413)');
  });

  it('reports an early close for successful responses that never completed', () => {
    expect(describeIncompleteStream(200, { type: 'progress' })).toMatch(/closed the connection/);
  });
});
