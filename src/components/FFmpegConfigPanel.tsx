"use client";

import React, { useState, useEffect } from "react";
import { Settings, RefreshCw, Cpu, Film, Volume2, HardDrive } from "lucide-react";

interface FFmpegEncoder {
  name: string;
  type: 'video' | 'audio';
  description: string;
  isHardware: boolean;
}

interface FFmpegFormat {
  name: string;
  description: string;
  canMux: boolean;
}

interface FFmpegCapabilities {
  version: string;
  videoEncoders: FFmpegEncoder[];
  audioEncoders: FFmpegEncoder[];
  formats: FFmpegFormat[];
  hwaccels: string[];
  probedAt: number;
}

export interface ExportConfig {
  container: string;
  videoEncoder: string;
  audioEncoder: string;
  videoBitrate: string;
  audioBitrate: string;
  resolution: string;
  crf: number;
}

interface FFmpegConfigPanelProps {
  config: ExportConfig;
  onChange: (config: ExportConfig) => void;
}

const DEFAULT_CONFIG: ExportConfig = {
  container: 'mp4',
  videoEncoder: 'libx264',
  audioEncoder: 'aac',
  videoBitrate: 'auto',
  audioBitrate: '128k',
  resolution: 'original',
  crf: 23,
};

const RESOLUTIONS = [
  { value: 'original', label: 'Original' },
  { value: '3840x2160', label: '4K (3840×2160)' },
  { value: '2560x1440', label: '1440p (2560×1440)' },
  { value: '1920x1080', label: '1080p (1920×1080)' },
  { value: '1280x720', label: '720p (1280×720)' },
  { value: '854x480', label: '480p (854×480)' },
];

const CRF_PRESETS = [
  { value: 18, label: 'High Quality' },
  { value: 23, label: 'Balanced' },
  { value: 28, label: 'Smaller Size' },
  { value: 35, label: 'Minimum Size' },
];

export function FFmpegConfigPanel({ config, onChange }: FFmpegConfigPanelProps) {
  const [capabilities, setCapabilities] = useState<FFmpegCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchCapabilities();
  }, []);

  const fetchCapabilities = async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ffmpeg?preferred=true${refresh ? '&refresh=true' : ''}`);
      if (!res.ok) throw new Error('Failed to fetch FFmpeg capabilities');
      const data = await res.json();
      setCapabilities(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const update = (partial: Partial<ExportConfig>) => {
    onChange({ ...config, ...partial });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 text-xs text-[#888888] hover:text-[#cccccc] transition-colors"
      >
        <Settings className="w-3.5 h-3.5" />
        <span>Export Settings</span>
      </button>
    );
  }

  return (
    <div className="bg-[#1e1e1e] border border-[#333333] rounded-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-2 bg-[#2d2d2d] border-b border-[#333333]">
        <div className="flex items-center space-x-2">
          <Settings className="w-3.5 h-3.5 text-[#888888]" />
          <span className="text-xs font-bold text-[#888888] uppercase tracking-wider">Export Settings</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => fetchCapabilities(true)}
            disabled={loading}
            className="p-1 rounded-sm hover:bg-[#3e3e42] transition-colors"
            title="Refresh FFmpeg capabilities"
          >
            <RefreshCw className={`w-3 h-3 text-[#666666] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-xs text-[#666666] hover:text-[#cccccc] px-1"
          >
            ×
          </button>
        </div>
      </div>

      {error && (
        <div className="p-2 text-xs text-red-400 bg-red-950/20">
          {error}
        </div>
      )}

      <div className="p-3 space-y-3">
        {/* Version Info */}
        {capabilities && (
          <div className="text-[10px] text-[#555555] flex items-center space-x-1">
            <span>FFmpeg {capabilities.version}</span>
            {capabilities.hwaccels.length > 0 && (
              <>
                <span>•</span>
                <Cpu className="w-3 h-3" />
                <span>{capabilities.hwaccels.join(', ')}</span>
              </>
            )}
          </div>
        )}

        {/* Container Format */}
        <div className="space-y-1">
          <label className="flex items-center space-x-1 text-[10px] uppercase font-bold text-[#666666] tracking-wider">
            <HardDrive className="w-3 h-3" />
            <span>Container</span>
          </label>
          <select
            value={config.container}
            onChange={(e) => update({ container: e.target.value })}
            disabled={loading}
            className="w-full bg-[#252526] border border-[#3e3e42] text-[#cccccc] text-xs p-1.5 focus:border-[#007acc] outline-none"
          >
            {capabilities?.formats.map(f => (
              <option key={f.name} value={f.name}>
                {f.name.toUpperCase()} - {f.description}
              </option>
            )) || (
              <>
                <option value="mp4">MP4 - MPEG-4 Part 14</option>
                <option value="matroska">MKV - Matroska</option>
                <option value="webm">WebM</option>
              </>
            )}
          </select>
        </div>

        {/* Video Encoder */}
        <div className="space-y-1">
          <label className="flex items-center space-x-1 text-[10px] uppercase font-bold text-[#666666] tracking-wider">
            <Film className="w-3 h-3" />
            <span>Video Encoder</span>
          </label>
          <select
            value={config.videoEncoder}
            onChange={(e) => update({ videoEncoder: e.target.value })}
            disabled={loading}
            className="w-full bg-[#252526] border border-[#3e3e42] text-[#cccccc] text-xs p-1.5 focus:border-[#007acc] outline-none"
          >
            {capabilities?.videoEncoders.map(e => (
              <option key={e.name} value={e.name}>
                {e.name} {e.isHardware ? '(HW)' : ''} - {e.description}
              </option>
            )) || (
              <>
                <option value="libx264">libx264 - H.264</option>
                <option value="libx265">libx265 - H.265/HEVC</option>
              </>
            )}
          </select>
        </div>

        {/* Audio Encoder */}
        <div className="space-y-1">
          <label className="flex items-center space-x-1 text-[10px] uppercase font-bold text-[#666666] tracking-wider">
            <Volume2 className="w-3 h-3" />
            <span>Audio Encoder</span>
          </label>
          <select
            value={config.audioEncoder}
            onChange={(e) => update({ audioEncoder: e.target.value })}
            disabled={loading}
            className="w-full bg-[#252526] border border-[#3e3e42] text-[#cccccc] text-xs p-1.5 focus:border-[#007acc] outline-none"
          >
            {capabilities?.audioEncoders.map(e => (
              <option key={e.name} value={e.name}>
                {e.name} - {e.description}
              </option>
            )) || (
              <>
                <option value="aac">AAC</option>
                <option value="libmp3lame">MP3</option>
              </>
            )}
          </select>
        </div>

        {/* Resolution */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-[#666666] tracking-wider">
            Resolution
          </label>
          <select
            value={config.resolution}
            onChange={(e) => update({ resolution: e.target.value })}
            className="w-full bg-[#252526] border border-[#3e3e42] text-[#cccccc] text-xs p-1.5 focus:border-[#007acc] outline-none"
          >
            {RESOLUTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Quality (CRF) */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-[#666666] tracking-wider">
            Quality (CRF: {config.crf})
          </label>
          <input
            type="range"
            min="0"
            max="51"
            value={config.crf}
            onChange={(e) => update({ crf: parseInt(e.target.value) })}
            className="w-full accent-[#007acc]"
          />
          <div className="flex justify-between text-[9px] text-[#555555]">
            <span>Lossless</span>
            <span>Smaller</span>
          </div>
        </div>

        {/* Audio Bitrate */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-[#666666] tracking-wider">
            Audio Bitrate
          </label>
          <select
            value={config.audioBitrate}
            onChange={(e) => update({ audioBitrate: e.target.value })}
            className="w-full bg-[#252526] border border-[#3e3e42] text-[#cccccc] text-xs p-1.5 focus:border-[#007acc] outline-none"
          >
            <option value="64k">64 kbps (Low)</option>
            <option value="128k">128 kbps (Standard)</option>
            <option value="192k">192 kbps (High)</option>
            <option value="256k">256 kbps (Very High)</option>
            <option value="320k">320 kbps (Maximum)</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_CONFIG };
