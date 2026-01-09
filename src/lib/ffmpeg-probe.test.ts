import { probeFFmpeg } from './ffmpeg-probe';
import { exec } from 'child_process';

jest.mock('child_process');
// Do NOT mock util. let promisify work naturally with our callback-invoking exec mock.

describe('ffmpeg-probe', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to mock exec output
  // unused helper removed
  
  test('parses version correctly', async () => {
    // We need to match specific commands
    (exec as unknown as jest.Mock).mockImplementation((cmd, options, callback) => {
       const cb = typeof options === 'function' ? options : callback;
       
       if (cmd.includes('-version')) {
         cb(null, { stdout: 'ffmpeg version 6.0-static', stderr: '' });
       } else if (cmd.includes('-encoders')) {
         cb(null, { stdout: '', stderr: '' });
       } else if (cmd.includes('-formats')) {
         cb(null, { stdout: '', stderr: '' });
       } else {
         cb(null, { stdout: '', stderr: '' });
       }
       return {} as any;
    });

    const caps = await probeFFmpeg(true); // force refresh
    expect(caps.version).toBe('6.0-static');
  });

  test('parses encoders correctly', async () => {
    const encodersOutput = [
      '------',
      'V..... libx264              libx264 H.264 / AVC / MPEG-4 AVC',
      'A..... aac                  AAC (Advanced Audio Coding)',
      'V..... h264_nvenc           NVIDIA NVENC H.264 encoder'
    ].join('\n');

    (exec as unknown as jest.Mock).mockImplementation((cmd, opts, cb) => {
        const callback = cb || opts;
        if (cmd.includes('-encoders')) {
            callback(null, { stdout: encodersOutput, stderr: '' });
        } else if (cmd.includes('-version')) {
            callback(null, { stdout: 'ffmpeg version 5.1', stderr: '' });
        } else {
            callback(null, { stdout: '', stderr: '' });
        }
        return {} as any;
    });

    const caps = await probeFFmpeg(true);
    
    expect(caps.videoEncoders).toHaveLength(2); // libx264, h264_nvenc
    expect(caps.audioEncoders).toHaveLength(1); // aac
    
    // Check hardware flag
    const nvenc = caps.videoEncoders.find(e => e.name === 'h264_nvenc');
    expect(nvenc?.isHardware).toBe(true);
    
    const x264 = caps.videoEncoders.find(e => e.name === 'libx264');
    expect(x264?.isHardware).toBe(false);
  });
});
