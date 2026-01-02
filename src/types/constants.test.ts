import { REFERENCE_WIDTH, REFERENCE_HEIGHT, REFERENCE_PIXELS, DEFAULT_FPS } from '@/types/constants';

describe('constants', () => {
  test('REFERENCE_WIDTH is 1920', () => {
    expect(REFERENCE_WIDTH).toBe(1920);
  });

  test('REFERENCE_HEIGHT is 1080', () => {
    expect(REFERENCE_HEIGHT).toBe(1080);
  });

  test('REFERENCE_PIXELS is the product of width and height', () => {
    expect(REFERENCE_PIXELS).toBe(REFERENCE_WIDTH * REFERENCE_HEIGHT);
    expect(REFERENCE_PIXELS).toBe(2073600);
  });

  test('DEFAULT_FPS is 30', () => {
    expect(DEFAULT_FPS).toBe(30);
  });
});
