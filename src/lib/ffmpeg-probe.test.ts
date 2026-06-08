import { probeFFmpeg } from './ffmpeg-probe';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process');

describe('ffmpeg-probe', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockSpawn = (stdout: string, stderr: string = '', code: number = 0) => {
    const stdoutStream = new EventEmitter();
    const stderrStream = new EventEmitter();
    const proc = new EventEmitter() as any;
    proc.stdout = stdoutStream;
    proc.stderr = stderrStream;
    proc.kill = jest.fn();

    (spawn as jest.Mock).mockImplementation(() => {
      setTimeout(() => {
        if (stdout) stdoutStream.emit('data', Buffer.from(stdout));
        if (stderr) stderrStream.emit('data', Buffer.from(stderr));
        setTimeout(() => {
          proc.emit('close', code);
        }, 10);
      }, 10);
      return proc;
    });
  };

  test('parses version correctly', async () => {
    (spawn as jest.Mock).mockImplementation((cmd, args) => {
        const stdoutStream = new EventEmitter();
        const stderrStream = new EventEmitter();
        const proc = new EventEmitter() as any;
        proc.stdout = stdoutStream;
        proc.stderr = stderrStream;
        
        setTimeout(() => {
            if (args.includes('-version')) {
                stdoutStream.emit('data', Buffer.from('ffmpeg version 6.0-static'));
            } else {
                stdoutStream.emit('data', Buffer.from(''));
            }
            proc.emit('close', 0);
        }, 10);
        return proc;
    });

    const caps = await probeFFmpeg(true);
    expect(caps.version).toBe('6.0-static');
  });

  test('parses encoders correctly', async () => {
    const encodersOutput = [
      '------',
      ' V..... libx264              libx264 H.264 / AVC / MPEG-4 AVC',
      ' A..... aac                  AAC (Advanced Audio Coding)',
      ' V..... h264_nvenc           NVIDIA NVENC H.264 encoder'
    ].join('\n');

    (spawn as jest.Mock).mockImplementation((cmd, args) => {
        const stdoutStream = new EventEmitter();
        const stderrStream = new EventEmitter();
        const proc = new EventEmitter() as any;
        proc.stdout = stdoutStream;
        proc.stderr = stderrStream;
        
        setTimeout(() => {
            if (args.includes('-encoders')) {
                stdoutStream.emit('data', Buffer.from(encodersOutput));
            } else if (args.includes('-version')) {
                stdoutStream.emit('data', Buffer.from('ffmpeg version 5.1'));
            } else {
                stdoutStream.emit('data', Buffer.from(''));
            }
            proc.emit('close', 0);
        }, 10);
        return proc;
    });

    const caps = await probeFFmpeg(true);
    
    expect(caps.videoEncoders).toHaveLength(2); // libx264, h264_nvenc
    expect(caps.audioEncoders).toHaveLength(1); // aac
    
    const nvenc = caps.videoEncoders.find(e => e.name === 'h264_nvenc');
    expect(nvenc?.isHardware).toBe(true);
  });
});
