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
  hwaccel: 'nvenc' | 'qsv' | 'videotoolbox' | 'none';
  preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
  crf: number;
  resolution: string;
}

interface FFmpegConfigPanelProps {
  config: ExportConfig;
  onChange: (config: ExportConfig) => void;
}

const DEFAULT_CONFIG: ExportConfig = {
  hwaccel: 'none',
  preset: 'veryfast',
  crf: 23,
  resolution: 'original',
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

        {/* Hardware Acceleration */}
        <div className="space-y-1">
          <label className="flex items-center space-x-1 text-[10px] uppercase font-bold text-[#666666] tracking-wider">
            <Cpu className="w-3 h-3" />
            <span>Hardware Acceleration</span>
          </label>
          <select
            value={config.hwaccel}
            onChange={(e) => update({ hwaccel: e.target.value as any })}
            disabled={loading}
            className="w-full bg-[#252526] border border-[#3e3e42] text-[#cccccc] text-xs p-1.5 focus:border-[#007acc] outline-none"
          >
            <option value="none">None (CPU)</option>
            {capabilities?.hwaccels.includes('nvenc') && <option value="nvenc">NVIDIA (NVENC)</option>}
            {capabilities?.hwaccels.includes('qsv') && <option value="qsv">Intel (QuickSync)</option>}
            {capabilities?.hwaccels.includes('videotoolbox') && <option value="videotoolbox">Apple (VideoToolbox)</option>}
          </select>
        </div>

        {/* Preset */}
        <div className="space-y-1">
          <label className="flex items-center space-x-1 text-[10px] uppercase font-bold text-[#666666] tracking-wider">
            <Settings className="w-3 h-3" />
            <span>Preset</span>
          </label>
          <select
            value={config.preset}
            onChange={(e) => update({ preset: e.target.value as any })}
            disabled={loading}
            className="w-full bg-[#252526] border border-[#3e3e42] text-[#cccccc] text-xs p-1.5 focus:border-[#007acc] outline-none"
          >
            <option value="ultrafast">Ultrafast</option>
            <option value="superfast">Superfast</option>
            <option value="veryfast">Veryfast</option>
            <option value="faster">Faster</option>
            <option value="fast">Fast</option>
            <option value="medium">Medium</option>
            <option value="slow">Slow</option>
            <option value="slower">Slower</option>
            <option value="veryslow">Veryslow</option>
          </select>
        </div>

        {/* Resolution */}
        <div className="space-y-1">
          <label className="flex items-center space-x-1 text-[10px] uppercase font-bold text-[#666666] tracking-wider">
            <Film className="w-3 h-3" />
            <span>Resolution</span>
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
      </div>
    </div>
  );
}

export { DEFAULT_CONFIG };
