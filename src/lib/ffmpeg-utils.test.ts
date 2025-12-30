/**
 * ffmpeg-utils.test.ts - Unit tests for FFmpeg utilities
 * 
 * Uses Jest mocking for child_process.spawn to test command generation
 * and output parsing without requiring actual FFmpeg installation.
 */

import { EventEmitter } from 'events';

// Mock child_process before imports
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

// Mock fs for file checks
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
}));

import { spawn } from 'child_process';
import { ffprobe, getAudioCodec, getVideoDimensions, extractAudio, burnSubtitles } from './ffmpeg-utils';

// Helper to create mock process with EventEmitter
function createMockProcess() {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdin = { write: jest.fn(), end: jest.fn() };
  return proc;
}

describe('ffmpeg-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // ffprobe tests
  // ============================================================================
  describe('ffprobe', () => {
    it('should parse video metadata from ffprobe output', async () => {
      const mockProc = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProc);

      const promise = ffprobe('/path/to/video.mp4');

      // Simulate ffprobe JSON output
      const ffprobeOutput = JSON.stringify({
        format: { duration: '120.5' },
        streams: [
          { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, r_frame_rate: '30/1' },
          { codec_type: 'audio', codec_name: 'aac' },
        ],
      });

      mockProc.stdout.emit('data', ffprobeOutput);
      mockProc.emit('close', 0);

      const result = await promise;

      expect(result).toEqual({
        duration: 120.5,
        width: 1920,
        height: 1080,
        audioCodec: 'aac',
        videoCodec: 'h264',
        fps: 30,
      });

      expect(spawn).toHaveBeenCalledWith('ffprobe', expect.arrayContaining([
        '-v', 'quiet',
        '-print_format', 'json',
        '/path/to/video.mp4',
      ]));
    });

    it('should handle missing streams gracefully', async () => {
      const mockProc = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProc);

      const promise = ffprobe('/path/to/audio-only.mp3');

      const output = JSON.stringify({
        format: { duration: '60.0' },
        streams: [{ codec_type: 'audio', codec_name: 'mp3' }],
      });

      mockProc.stdout.emit('data', output);
      mockProc.emit('close', 0);

      const result = await promise;

      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
      expect(result.audioCodec).toBe('mp3');
      expect(result.videoCodec).toBeUndefined();
    });

    it('should reject on non-zero exit code', async () => {
      const mockProc = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProc);

      const promise = ffprobe('/nonexistent.mp4');

      mockProc.stderr.emit('data', 'No such file or directory');
      mockProc.emit('close', 1);

      await expect(promise).rejects.toThrow('ffprobe failed with code 1');
    });

    it('should reject on invalid JSON output', async () => {
      const mockProc = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProc);

      const promise = ffprobe('/path/to/video.mp4');

      mockProc.stdout.emit('data', 'not valid json');
      mockProc.emit('close', 0);

      await expect(promise).rejects.toThrow('Failed to parse ffprobe output');
    });

    it('should reject on spawn error', async () => {
      const mockProc = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProc);

      const promise = ffprobe('/path/to/video.mp4');

      mockProc.emit('error', new Error('spawn ffprobe ENOENT'));

      await expect(promise).rejects.toThrow('spawn ffprobe ENOENT');
    });
  });

  // ============================================================================
  // getAudioCodec tests
  // ============================================================================
  describe('getAudioCodec', () => {
    it('should return audio codec from metadata', async () => {
      const mockProc = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProc);

      const promise = getAudioCodec('/path/to/video.mp4');

      const output = JSON.stringify({
        format: { duration: '60.0' },
        streams: [
          { codec_type: 'audio', codec_name: 'opus' },
        ],
      });

      mockProc.stdout.emit('data', output);
      mockProc.emit('close', 0);

      const result = await promise;
      expect(result).toBe('opus');
    });

    it('should return "unknown" when no audio stream', async () => {
      const mockProc = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProc);

      const promise = getAudioCodec('/path/to/silent.mp4');

      const output = JSON.stringify({
        format: { duration: '60.0' },
        streams: [{ codec_type: 'video', codec_name: 'h264' }],
      });

      mockProc.stdout.emit('data', output);
      mockProc.emit('close', 0);

      const result = await promise;
      expect(result).toBe('unknown');
    });
  });

  // ============================================================================
  // getVideoDimensions tests
  // ============================================================================
  describe('getVideoDimensions', () => {
    it('should return width and height', async () => {
      const mockProc = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProc);

      const promise = getVideoDimensions('/path/to/video.mp4');

      const output = JSON.stringify({
        format: {},
        streams: [{ codec_type: 'video', width: 3840, height: 2160 }],
      });

      mockProc.stdout.emit('data', output);
      mockProc.emit('close', 0);

      const result = await promise;
      expect(result).toEqual({ width: 3840, height: 2160 });
    });
  });

  // ============================================================================
  // extractAudio tests
  // ============================================================================
  describe('extractAudio', () => {
    it('should call ffmpeg with correct arguments', async () => {
      const mockProc = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProc);

      const promise = extractAudio('/input/video.mp4', '/output/audio.aac');

      mockProc.emit('close', 0);

      const result = await promise;

      expect(spawn).toHaveBeenCalledWith('ffmpeg', [
        '-i', '/input/video.mp4',
        '-vn',
        '-acodec', 'copy',
        '-y',
        '/output/audio.aac',
      ]);

      expect(result).toBe('/output/audio.aac');
    });

    it('should reject on ffmpeg failure', async () => {
      const mockProc = createMockProcess();
      (spawn as jest.Mock).mockReturnValue(mockProc);

      const promise = extractAudio('/input/video.mp4', '/output/audio.aac');

      mockProc.stderr.emit('data', 'Error opening input file');
      mockProc.emit('close', 1);

      await expect(promise).rejects.toThrow('ffmpeg extractAudio failed');
    });
  });

  // ============================================================================
  // burnSubtitles tests
  // ============================================================================
  describe('burnSubtitles', () => {
    it('should use libx264 encoder with default options', async () => {
      // First call for ffprobe (duration), second for ffmpeg
      const mockFfprobeProc = createMockProcess();
      const mockFfmpegProc = createMockProcess();
      
      (spawn as jest.Mock)
        .mockReturnValueOnce(mockFfprobeProc) // ffprobe
        .mockReturnValueOnce(mockFfmpegProc); // ffmpeg

      const promise = burnSubtitles('/input.mp4', '/subs.ass', '/output.mp4');

      // Resolve ffprobe first
      const probeOutput = JSON.stringify({
        format: { duration: '100' },
        streams: [{ codec_type: 'video', width: 1920, height: 1080 }],
      });
      mockFfprobeProc.stdout.emit('data', probeOutput);
      mockFfprobeProc.emit('close', 0);

      // Wait a tick for burnSubtitles to start ffmpeg
      await new Promise(r => setTimeout(r, 10));

      // Complete ffmpeg
      mockFfmpegProc.emit('close', 0);

      const result = await promise;
      expect(result).toBe('/output.mp4');

      // Check ffmpeg was called with correct encoder
      const ffmpegCall = (spawn as jest.Mock).mock.calls.find(
        call => call[0] === 'ffmpeg'
      );
      expect(ffmpegCall).toBeDefined();
      expect(ffmpegCall[1]).toContain('-c:v');
      expect(ffmpegCall[1]).toContain('libx264');
      expect(ffmpegCall[1]).toContain('-preset');
      expect(ffmpegCall[1]).toContain('veryfast');
    });

    it('should use hardware encoder when specified', async () => {
      const mockFfprobeProc = createMockProcess();
      const mockFfmpegProc = createMockProcess();
      
      (spawn as jest.Mock)
        .mockReturnValueOnce(mockFfprobeProc)
        .mockReturnValueOnce(mockFfmpegProc);

      const promise = burnSubtitles('/input.mp4', '/subs.ass', '/output.mp4', {
        hwaccel: 'nvenc',
      });

      const probeOutput = JSON.stringify({
        format: { duration: '100' },
        streams: [{ codec_type: 'video', width: 1920, height: 1080 }],
      });
      mockFfprobeProc.stdout.emit('data', probeOutput);
      mockFfprobeProc.emit('close', 0);

      await new Promise(r => setTimeout(r, 10));
      mockFfmpegProc.emit('close', 0);

      await promise;

      const ffmpegCall = (spawn as jest.Mock).mock.calls.find(
        call => call[0] === 'ffmpeg'
      );
      expect(ffmpegCall[1]).toContain('h264_nvenc');
    });

    it('should add sample duration flag when specified', async () => {
      const mockFfprobeProc = createMockProcess();
      const mockFfmpegProc = createMockProcess();
      
      (spawn as jest.Mock)
        .mockReturnValueOnce(mockFfprobeProc)
        .mockReturnValueOnce(mockFfmpegProc);

      const promise = burnSubtitles('/input.mp4', '/subs.ass', '/output.mp4', {
        sampleDuration: 30,
      });

      const probeOutput = JSON.stringify({
        format: { duration: '100' },
        streams: [{ codec_type: 'video', width: 1920, height: 1080 }],
      });
      mockFfprobeProc.stdout.emit('data', probeOutput);
      mockFfprobeProc.emit('close', 0);

      await new Promise(r => setTimeout(r, 10));
      mockFfmpegProc.emit('close', 0);

      await promise;

      const ffmpegCall = (spawn as jest.Mock).mock.calls.find(
        call => call[0] === 'ffmpeg'
      );
      expect(ffmpegCall[1]).toContain('-t');
      expect(ffmpegCall[1]).toContain('30');
    });

    it('should apply resolution scaling when specified', async () => {
      const mockFfprobeProc = createMockProcess();
      const mockFfmpegProc = createMockProcess();
      
      (spawn as jest.Mock)
        .mockReturnValueOnce(mockFfprobeProc)
        .mockReturnValueOnce(mockFfmpegProc);

      const promise = burnSubtitles('/input.mp4', '/subs.ass', '/output.mp4', {
        resolution: '1280x720',
      });

      const probeOutput = JSON.stringify({
        format: { duration: '100' },
        streams: [{ codec_type: 'video', width: 1920, height: 1080 }],
      });
      mockFfprobeProc.stdout.emit('data', probeOutput);
      mockFfprobeProc.emit('close', 0);

      await new Promise(r => setTimeout(r, 10));
      mockFfmpegProc.emit('close', 0);

      await promise;

      const ffmpegCall = (spawn as jest.Mock).mock.calls.find(
        call => call[0] === 'ffmpeg'
      );
      const vfIndex = ffmpegCall[1].indexOf('-vf');
      expect(vfIndex).toBeGreaterThan(-1);
      expect(ffmpegCall[1][vfIndex + 1]).toContain('scale=1280:720');
    });

    it('should call onProgress with percentage during encoding', async () => {
      const mockFfprobeProc = createMockProcess();
      const mockFfmpegProc = createMockProcess();
      
      (spawn as jest.Mock)
        .mockReturnValueOnce(mockFfprobeProc)
        .mockReturnValueOnce(mockFfmpegProc);

      const onProgress = jest.fn();

      const promise = burnSubtitles('/input.mp4', '/subs.ass', '/output.mp4', {
        onProgress,
      });

      // Resolve ffprobe
      const probeOutput = JSON.stringify({
        format: { duration: '100' },
        streams: [{ codec_type: 'video', width: 1920, height: 1080 }],
      });
      mockFfprobeProc.stdout.emit('data', probeOutput);
      mockFfprobeProc.emit('close', 0);

      await new Promise(r => setTimeout(r, 10));

      // Simulate progress updates
      mockFfmpegProc.stderr.emit('data', 'frame=100 time=00:00:50.00 bitrate=1000kbps');
      mockFfmpegProc.stderr.emit('data', 'frame=200 time=00:01:00.00 bitrate=1000kbps');

      mockFfmpegProc.emit('close', 0);

      await promise;

      expect(onProgress).toHaveBeenCalledWith(50, expect.anything());
      expect(onProgress).toHaveBeenCalledWith(60, expect.anything());
    });

    it('should reject on ffmpeg failure', async () => {
      const mockFfprobeProc = createMockProcess();
      const mockFfmpegProc = createMockProcess();
      
      (spawn as jest.Mock)
        .mockReturnValueOnce(mockFfprobeProc)
        .mockReturnValueOnce(mockFfmpegProc);

      const promise = burnSubtitles('/input.mp4', '/subs.ass', '/output.mp4');

      const probeOutput = JSON.stringify({
        format: { duration: '100' },
        streams: [{ codec_type: 'video', width: 1920, height: 1080 }],
      });
      mockFfprobeProc.stdout.emit('data', probeOutput);
      mockFfprobeProc.emit('close', 0);

      await new Promise(r => setTimeout(r, 10));
      
      mockFfmpegProc.stderr.emit('data', 'Error during encoding');
      mockFfmpegProc.emit('close', 1);

      await expect(promise).rejects.toThrow('FFmpeg failed with code 1');
    });
  });
});
