import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    const absolutePath = path.resolve(filePath);
    
    // Security check
    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Use ffprobe to get video info
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${absolutePath}"`
    );

    const probeData = JSON.parse(stdout);
    const format = probeData.format || {};
    const streams = probeData.streams || [];
    
    const videoStream = streams.find((s: any) => s.codec_type === 'video');
    const audioStream = streams.find((s: any) => s.codec_type === 'audio');

    const properties = {
      filename: format.filename ? path.basename(format.filename) : 'Unknown',
      filePath: absolutePath,
      fileSize: parseInt(format.size || '0', 10),
      duration: parseFloat(format.duration || '0'),
      container: format.format_long_name || format.format_name || 'Unknown',
      
      // Video
      videoCodec: videoStream?.codec_name,
      videoCodecLong: videoStream?.codec_long_name,
      width: videoStream?.width,
      height: videoStream?.height,
      frameRate: videoStream?.r_frame_rate ? eval(videoStream.r_frame_rate) : undefined,
      videoBitrate: videoStream?.bit_rate ? parseInt(videoStream.bit_rate, 10) : undefined,
      pixelFormat: videoStream?.pix_fmt,
      
      // Audio
      audioCodec: audioStream?.codec_name,
      audioCodecLong: audioStream?.codec_long_name,
      audioChannels: audioStream?.channels,
      audioSampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate, 10) : undefined,
      audioBitrate: audioStream?.bit_rate ? parseInt(audioStream.bit_rate, 10) : undefined,
    };

    return NextResponse.json(properties);
  } catch (error: any) {
    console.error('Probe error:', error);
    return NextResponse.json({ error: error.message || 'Failed to probe video' }, { status: 500 });
  }
}
