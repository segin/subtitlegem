"use client";

import React, { useState } from "react";
import { SubtitleLine, SubtitleConfig } from "@/types/subtitle";
import { QueueItem } from "@/lib/queue-manager";
import { Download, Play, Loader2 } from "lucide-react";

interface ExportControlsProps {
  subtitles: SubtitleLine[];
  videoPath: string | null;
  config: SubtitleConfig;
  queueItems: QueueItem[];
  onExport: (sampleDuration: number | null) => void;
}

export function ExportControls({
  subtitles,
  videoPath,
  config,
  queueItems,
  onExport,
}: ExportControlsProps) {
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (duration: number | null) => {
    setSelectedDuration(duration);
    setExporting(true);
    
    try {
      await onExport(duration);
    } finally {
      setExporting(false);
      setSelectedDuration(null);
    }
  };

  const processingCount = queueItems.filter(i => i.status === 'processing' || i.status === 'pending').length;

  return (
    <div className="border-t border-[#333333] bg-[#252526] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-[#888888] uppercase tracking-wider">Export Video</h3>
        {processingCount > 0 && (
          <span className="text-[10px] text-[#007acc] font-mono">
            {processingCount} {processingCount === 1 ? 'job' : 'jobs'} in queue
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Full Video Export */}
        <button
          onClick={() => handleExport(null)}
          disabled={exporting || !videoPath}
          className="flex items-center justify-center space-x-2 py-2.5 px-4 bg-[#007acc] hover:bg-[#0062a3] disabled:bg-[#3e3e42] disabled:text-[#666666] text-white text-sm font-medium rounded-sm transition-colors"
        >
          {exporting && selectedDuration === null ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Adding to Queue...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Export Full Video</span>
            </>
          )}
        </button>

        {/* Sample Export Dropdown */}
        <div className="relative">
          <select
            onChange={(e) => {
              const duration = e.target.value ? parseInt(e.target.value) : null;
              if (duration) handleExport(duration);
              e.target.value = ''; // Reset select
            }}
            disabled={exporting || !videoPath}
            className="w-full h-full bg-[#2d2d2d] hover:bg-[#3e3e42] disabled:bg-[#1e1e1e] disabled:text-[#666666] border border-[#444444] text-[#cccccc] text-sm font-medium rounded-sm px-4 py-2.5 cursor-pointer transition-colors"
            defaultValue=""
          >
            <option value="" disabled>Export Sample...</option>
            <option value="2">2 seconds</option>
            <option value="5">5 seconds</option>
            <option value="10">10 seconds</option>
          </select>
        </div>
      </div>

      <p className="text-[10px] text-[#666666] mt-3">
        <span className="text-[#d7ba7d]">💡 Tip:</span> Use sample exports to test subtitle positioning before exporting the full video
      </p>
    </div>
  );
}
