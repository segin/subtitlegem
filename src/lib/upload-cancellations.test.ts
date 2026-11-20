import { markUploadCancelled, isUploadCancelled } from './upload-cancellations';

describe('upload cancellations', () => {
  it('remembers cancelled uploads', () => {
    expect(isUploadCancelled('a1')).toBe(false);
    markUploadCancelled('a1');
    expect(isUploadCancelled('a1')).toBe(true);
    expect(isUploadCancelled(null)).toBe(false);
    expect(isUploadCancelled('')).toBe(false);
  });

  it('forgets cancellations after a day', () => {
    const start = Date.now();
    markUploadCancelled('old', start);
    markUploadCancelled('new', start + 25 * 60 * 60 * 1000);
    expect(isUploadCancelled('old')).toBe(false);
    expect(isUploadCancelled('new')).toBe(true);
  });
});
