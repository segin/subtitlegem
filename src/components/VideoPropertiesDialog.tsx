"use client";

import React from "react";
import { X, FileVideo, Film, Volume2, Clock } from "lucide-react";

export interface VideoProperties {
  // File info
  filename: string;
  filePath: string;
  fileSize: number;
  duration: number;
  container: string;
  
  // Video stream
  videoCodec?: string;
  videoCodecLong?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  videoBitrate?: number;
  pixelFormat?: string;
  
  // Audio stream
  audioCodec?: string;
  audioCodecLong?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  audioBitrate?: number;
}

interface VideoPropertiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  properties: VideoProperties | null;
  loading?: boolean;
  error?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatBitrate(bps: number | undefined): string {
  if (!bps) return 'N/A';
  if (bps < 1000) return `${bps} bps`;
  if (bps < 1000000) return `${(bps / 1000).toFixed(0)} kbps`;
  return `${(bps / 1000000).toFixed(1)} Mbps`;
}

export function VideoPropertiesDialog({ isOpen, onClose, properties, loading, error }: VideoPropertiesDialogProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div 
        className="bg-[#252526] border border-[#3e3e42] rounded-lg shadow-2xl w-[480px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#333333]">
          <h2 className="text-sm font-bold text-[#e1e1e1] flex items-center gap-2">
            <FileVideo className="w-4 h-4 text-[#007acc]" />
            Video Properties
          </h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#3e3e42] rounded transition-colors"
          >
            <X className="w-4 h-4 text-[#888888]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 text-sm">
          {loading && (
            <div className="text-center text-[#888888] py-8">Loading properties...</div>
          )}
          
          {error && (
            <div className="text-center text-red-400 py-8">{error}</div>
          )}
          
          {properties && !loading && (
            <div className="space-y-4">
              {/* General */}
              <section>
                <h3 className="text-xs font-bold text-[#888888] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileVideo className="w-3 h-3" /> General
                </h3>
                <div className="bg-[#1e1e1e] rounded-md p-3 space-y-1.5">
                  <Row label="Filename" value={properties.filename} />
                  <Row label="Size" value={formatFileSize(properties.fileSize)} />
                  <Row label="Duration" value={formatDuration(properties.duration)} />
                  <Row label="Container" value={properties.container} />
                </div>
              </section>

              {/* Video Stream */}
              {properties.videoCodec && (
                <section>
                  <h3 className="text-xs font-bold text-[#888888] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Film className="w-3 h-3" /> Video
                  </h3>
                  <div className="bg-[#1e1e1e] rounded-md p-3 space-y-1.5">
                    <Row label="Codec" value={`${properties.videoCodec}${properties.videoCodecLong ? ` (${properties.videoCodecLong})` : ''}`} />
                    <Row label="Resolution" value={`${properties.width} × ${properties.height}`} />
                    <Row label="Frame Rate" value={`${properties.frameRate?.toFixed(2)} fps`} />
                    <Row label="Bitrate" value={formatBitrate(properties.videoBitrate)} />
                    {properties.pixelFormat && <Row label="Pixel Format" value={properties.pixelFormat} />}
                  </div>
                </section>
              )}

              {/* Audio Stream */}
              {properties.audioCodec && (
                <section>
                  <h3 className="text-xs font-bold text-[#888888] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Volume2 className="w-3 h-3" /> Audio
                  </h3>
                  <div className="bg-[#1e1e1e] rounded-md p-3 space-y-1.5">
                    <Row label="Codec" value={`${properties.audioCodec}${properties.audioCodecLong ? ` (${properties.audioCodecLong})` : ''}`} />
                    <Row label="Channels" value={properties.audioChannels === 2 ? 'Stereo' : properties.audioChannels === 1 ? 'Mono' : `${properties.audioChannels} channels`} />
                    <Row label="Sample Rate" value={`${properties.audioSampleRate} Hz`} />
                    <Row label="Bitrate" value={formatBitrate(properties.audioBitrate)} />
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#333333] flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-1.5 text-xs bg-[#3e3e42] hover:bg-[#4e4e52] rounded-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#888888]">{label}</span>
      <span className="text-[#e1e1e1] font-mono text-xs">{value || 'N/A'}</span>
    </div>
  );
}
