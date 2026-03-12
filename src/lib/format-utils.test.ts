import { formatBytes } from './format-utils';

describe('formatBytes', () => {
  test('handles 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  test('handles bytes less than 1024', () => {
    expect(formatBytes(1)).toBe('1 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  test('handles exact units', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 ** 2)).toBe('1 MB');
    expect(formatBytes(1024 ** 3)).toBe('1 GB');
    expect(formatBytes(1024 ** 4)).toBe('1 TB');
    expect(formatBytes(1024 ** 5)).toBe('1 PB');
    expect(formatBytes(1024 ** 6)).toBe('1 EB');
    expect(formatBytes(1024 ** 7)).toBe('1 ZB');
    expect(formatBytes(1024 ** 8)).toBe('1 YB');
  });

  test('handles fractional units with default decimals (2)', () => {
    expect(formatBytes(1500)).toBe('1.46 KB');
    expect(formatBytes(1024 * 1.5)).toBe('1.5 KB');
    expect(formatBytes(1024 ** 2 * 1.25)).toBe('1.25 MB');
  });

  test('handles custom decimal precision', () => {
    expect(formatBytes(1500, 0)).toBe('1 KB');
    expect(formatBytes(1500, 1)).toBe('1.5 KB');
    expect(formatBytes(1500, 3)).toBe('1.465 KB');
  });

  test('handles negative decimals by treating them as 0', () => {
    expect(formatBytes(1500, -1)).toBe('1 KB');
  });

  test('handles very large numbers (caps at YB)', () => {
    expect(formatBytes(1024 ** 9)).toBe('1024 YB');
    expect(formatBytes(1024 ** 10)).toBe('1048576 YB');
  });

  test('handles values between 0 and 1', () => {
    // Current implementation:
    // const i = bytes > 0 ? Math.floor(Math.log(bytes) / Math.log(k)) : 0;
    // log(0.5) / log(1024) is negative.
    // safeI = Math.max(0, i) handles this, making it 0.
    expect(formatBytes(0.5)).toBe('0.5 B');
  });
});
