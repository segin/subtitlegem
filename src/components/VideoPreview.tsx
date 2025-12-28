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
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSubtitle, setActiveSubtitle] = useState<SubtitleLine | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(16/9);
  const [containerHeight, setContainerHeight] = useState<number>(0);

  useEffect(() => {
    const active = subtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime);
    setActiveSubtitle(active || null);
  }, [currentTime, subtitles]);

  // Track container dimension changes for WYSIWYG font scaling
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setContainerHeight(entry.contentRect.height);
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      onTimeUpdate(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const { videoWidth, videoHeight } = videoRef.current;
      if (videoWidth && videoHeight) {
        setAspectRatio(videoWidth / videoHeight);
      }
      onDurationChange(videoRef.current.duration);
    }
  };

  // Convert numpad alignment to flex/grid styles
  const getPositionStyles = (style: TrackStyle) => {
    const { alignment, marginV, marginH } = style;
    
    // Scale margins relative to container height (1080p reference)
    const scaleFactor = containerHeight / 1080;
    const scaledMarginV = marginV * scaleFactor;
    const scaledMarginH = marginH * scaleFactor;

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
      paddingTop: `${scaledMarginV}px`,
      paddingBottom: `${scaledMarginV}px`,
      paddingLeft: `${scaledMarginH}px`,
      paddingRight: `${scaledMarginH}px`,
    };
  };

  // Helper to scale font size relative to 1080p height
  const getScaledFontSize = (fontSize: number) => {
    if (containerHeight === 0) return fontSize;
    return (fontSize / 1080) * containerHeight;
  };

  return (
    <div className="relative w-full aspect-video bg-[#000000] flex items-center justify-center overflow-hidden border border-[#333333] shadow-lg">
      <div 
        ref={containerRef}
        className="relative h-full max-w-full"
        style={{ aspectRatio: `${aspectRatio}` }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-cover"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          controls
        />
        
        {activeSubtitle && (
          <>
            {/* Primary Track Layer */}
            <div style={getPositionStyles(config.primary)}>
               <div 
                  className="p-2 text-center max-w-[90%]"
                  style={{ 
                    backgroundColor: activeSubtitle.primaryColor || config.primary.backgroundColor,
                    color: activeSubtitle.primaryColor ? '#ffffff' : config.primary.color,
                    fontSize: `${getScaledFontSize(config.primary.fontSize)}px`,
                    fontFamily: config.primary.fontFamily,
                    borderRadius: '2px',
                    textShadow: activeSubtitle.primaryColor ? '1px 1px 2px rgba(0,0,0,0.8)' : 'none',
                  }}
                >
                  {activeSubtitle.text}
               </div>
            </div>

            {/* Secondary Track Layer */}
            {activeSubtitle.secondaryText && (
              <div style={getPositionStyles(config.secondary)}>
                 <div 
                    className="p-2 text-center max-w-[90%]"
                    style={{ 
                      backgroundColor: activeSubtitle.secondaryColor || config.secondary.backgroundColor,
                      color: activeSubtitle.secondaryColor ? '#ffffff' : config.secondary.color,
                      fontSize: `${getScaledFontSize(config.secondary.fontSize)}px`,
                      fontFamily: config.secondary.fontFamily,
                      borderRadius: '2px',
                      textShadow: activeSubtitle.secondaryColor ? '1px 1px 2px rgba(0,0,0,0.8)' : 'none',
                    }}
                  >
                    {activeSubtitle.secondaryText}
                 </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
