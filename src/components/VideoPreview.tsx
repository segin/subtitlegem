"use client";

import React, { useRef, useEffect, useState } from "react";
import { SubtitleLine, SubtitleConfig, TrackStyle, Alignment } from "@/types/subtitle";

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

  // Convert numpad alignment to flex/grid styles
  const getPositionStyles = (style: TrackStyle) => {
    const { alignment, marginV, marginH } = style;
    
    // Horizontal
    let justifyContent = 'center';
    if ([1, 4, 7].includes(alignment)) justifyContent = 'flex-start';
    if ([3, 6, 9].includes(alignment)) justifyContent = 'flex-end';

    // Vertical
    let alignItems = 'center';
    if ([7, 8, 9].includes(alignment)) alignItems = 'flex-start';
    if ([1, 2, 3].includes(alignment)) alignItems = 'flex-end';

    return {
      display: 'flex',
      width: '100%',
      height: '100%',
      position: 'absolute' as const,
      top: 0,
      left: 0,
      pointerEvents: 'none' as const,
      justifyContent,
      alignItems,
      paddingTop: `${marginV}px`,
      paddingBottom: `${marginV}px`,
      paddingLeft: `${marginH}px`,
      paddingRight: `${marginH}px`,
    };
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
      
      {activeSubtitle && (
        <>
          {/* Primary Track Layer */}
          <div style={getPositionStyles(config.primary)}>
             <div 
                className="p-2 rounded shadow-lg text-center max-w-[80%]"
                style={{ 
                  backgroundColor: config.primary.backgroundColor,
                  color: config.primary.color,
                  fontSize: `${config.primary.fontSize}px`,
                  fontFamily: config.primary.fontFamily,
                }}
              >
                {activeSubtitle.text}
             </div>
          </div>

          {/* Secondary Track Layer */}
          {activeSubtitle.secondaryText && (
            <div style={getPositionStyles(config.secondary)}>
               <div 
                  className="p-2 rounded shadow-lg text-center max-w-[80%]"
                  style={{ 
                    backgroundColor: config.secondary.backgroundColor,
                    color: config.secondary.color,
                    fontSize: `${config.secondary.fontSize}px`,
                    fontFamily: config.secondary.fontFamily,
                  }}
                >
                  {activeSubtitle.secondaryText}
               </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}