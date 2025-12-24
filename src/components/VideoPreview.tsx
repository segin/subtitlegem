"use client";

import React, { useRef, useEffect, useState } from "react";
import { SubtitleLine, SubtitleConfig } from "@/types/subtitle";

interface PreviewProps {
  videoUrl: string;
  subtitles: SubtitleLine[];
  config: SubtitleConfig;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
}

export function VideoPreview({ videoUrl, subtitles, config, currentTime, onTimeUpdate, onDurationChange }: PreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeSubtitle, setActiveSubtitle] = useState<SubtitleLine | null>(null);

  useEffect(() => {
    const active = subtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime);
    setActiveSubtitle(active || null);
  }, [currentTime, subtitles]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      onDurationChange(videoRef.current.duration);
    }
  };

  const getAlignmentClass = () => {
    switch (config.alignment) {
      case 'left': return 'text-left items-start';
      case 'right': return 'text-right items-end';
      default: return 'text-center items-center';
    }
  };

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-gray-800 shadow-2xl">
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        controls
      />
      
      {/* Subtitle Overlay */}
      {activeSubtitle && (
        <div 
          className={`absolute inset-0 pointer-events-none flex flex-col justify-end p-4 mb-[${config.marginH}px] px-[${config.marginW}px] ${getAlignmentClass()}`}
          style={{ 
            marginBottom: `${config.marginH}px`,
            paddingLeft: `${config.marginW}px`,
            paddingRight: `${config.marginW}px`
          }}
        >
          <div 
            className="p-2 rounded shadow-lg transition-all duration-200"
            style={{ 
              backgroundColor: config.backgroundColor,
              color: config.color,
              fontSize: `${config.fontSize}px`,
              fontFamily: config.fontFamily,
            }}
          >
            <p>{activeSubtitle.text}</p>
            {activeSubtitle.secondaryText && (
              <p className="opacity-90 mt-1 text-[0.85em]">{activeSubtitle.secondaryText}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
