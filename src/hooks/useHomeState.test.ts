import { renderHook, act } from '@testing-library/react';
import { useHomeState } from './useHomeState';
import { DEFAULT_CONFIG, DEFAULT_PROJECT_CONFIG } from '@/types/subtitle';

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ items: [], drafts: [], settings: {}, isPaused: false }),
  } as Response)
);

describe('useHomeState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('initializes with default values', () => {
    const { result } = renderHook(() => useHomeState());

    expect(result.current.videoUrl).toBeNull();
    expect(result.current.videoPath).toBeNull();
    expect(result.current.duration).toBe(0);
    expect(result.current.currentTime).toBe(0);
    expect(result.current.config).toEqual(DEFAULT_CONFIG);
    expect(result.current.projectConfig).toEqual(DEFAULT_PROJECT_CONFIG);
    expect(result.current.loading).toBe(false);
    expect(result.current.activeTab).toBe('list');
  });

  test('can update core state', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => {
      result.current.setVideoUrl('blob:test');
      result.current.setVideoPath('/test/video.mp4');
      result.current.setDuration(120);
      result.current.setCurrentTime(45);
    });

    expect(result.current.videoUrl).toBe('blob:test');
    expect(result.current.videoPath).toBe('/test/video.mp4');
    expect(result.current.duration).toBe(120);
    expect(result.current.currentTime).toBe(45);
  });

  test('can reset core state', () => {
    const { result } = renderHook(() => useHomeState());

    act(() => {
      result.current.setVideoUrl('blob:test');
      result.current.resetCoreState();
    });

    expect(result.current.videoUrl).toBeNull();
    expect(result.current.duration).toBe(0);
    expect(result.current.config).toEqual(DEFAULT_CONFIG);
  });

  test('dialog state works', () => {
    const { result } = renderHook(() => useHomeState());

    expect(result.current.showProjectSettings).toBe(false);

    act(() => {
      result.current.setShowProjectSettings(true);
    });

    expect(result.current.showProjectSettings).toBe(true);
  });


  test('isMultiVideoMode calculation', () => {
    const { result } = renderHook(() => useHomeState());

    expect(result.current.isMultiVideoMode).toBe(false);

    act(() => {
      result.current.setVideoClips([{ id: '1', filePath: 'a.mp4', originalFilename: 'a.mp4', duration: 10, width: 1920, height: 1080, subtitles: [] }, { id: '2', filePath: 'b.mp4', originalFilename: 'b.mp4', duration: 10, width: 1920, height: 1080, subtitles: [] }]);
    });

    expect(result.current.isMultiVideoMode).toBe(true);
  });
});
