"use client";

import React, { useRef, useEffect, useState } from "react";
import { SubtitleLine, SubtitleConfig, TrackStyle, DEFAULT_GLOBAL_SETTINGS } from "@/types/subtitle";
import { resolveTrackStyle, normalizeToPx } from "@/lib/style-resolver";

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
  const [containerHeight, setContainerHeight] = useState<number>(0);

  // Resolve styles with proper inheritance: Global -> Project -> Line
  const resolvedPrimaryStyle = resolveTrackStyle(
    DEFAULT_GLOBAL_SETTINGS.defaultPrimaryStyle,
    config.primary
  );
  const resolvedSecondaryStyle = resolveTrackStyle(
    DEFAULT_GLOBAL_SETTINGS.defaultSecondaryStyle,
    config.secondary
  );

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
  }, [videoUrl]);

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
    
    // Normalize to 1080p pixels, then scale to container
    const pxMarginV = normalizeToPx(marginV, 1080);
    const pxMarginH = normalizeToPx(marginH, 1920); // horizontal uses width ref
    
    const scaleFactor = containerHeight > 0 ? containerHeight / 1080 : 1;
    const scaledMarginV = pxMarginV * scaleFactor;
    const scaledMarginH = pxMarginH * scaleFactor;

    // Horizontal alignment
    let justifyContent = 'center';
    if ([1, 4, 7].includes(alignment)) justifyContent = 'flex-start';
    if ([3, 6, 9].includes(alignment)) justifyContent = 'flex-end';

    // Vertical alignment
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
  const getScaledFontSize = (fontSize: number | string) => {
    if (containerHeight === 0) return 16; // Fallback
    const pxSize = normalizeToPx(fontSize, 1080);
    return (pxSize / 1080) * containerHeight;
  };

  return (
    <div className="w-full bg-[#000000] flex items-center justify-center overflow-hidden border border-[#333333] shadow-lg p-4">
      <div 
        ref={containerRef}
        className="relative inline-block"
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="max-h-[65vh] max-w-full object-contain block"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          controls
        />
        
        {activeSubtitle && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Primary Track Layer */}
            <div style={getPositionStyles(resolvedPrimaryStyle)}>
               <div 
                  className="p-2 text-center max-w-[90%]"
                  style={{ 
                    backgroundColor: activeSubtitle.primaryColor || resolvedPrimaryStyle.backgroundColor,
                    color: activeSubtitle.primaryColor ? '#ffffff' : resolvedPrimaryStyle.color,
                    fontSize: `${getScaledFontSize(resolvedPrimaryStyle.fontSize)}px`,
                    fontFamily: resolvedPrimaryStyle.fontFamily,
                    borderRadius: '2px',
                    textShadow: activeSubtitle.primaryColor ? '1px 1px 2px rgba(0,0,0,0.8)' : 'none',
                  }}
                >
                  {activeSubtitle.text}
               </div>
            </div>

            {/* Secondary Track Layer */}
            {activeSubtitle.secondaryText && (
              <div style={getPositionStyles(resolvedSecondaryStyle)}>
                 <div 
                    className="p-2 text-center max-w-[90%]"
                    style={{ 
                      backgroundColor: activeSubtitle.secondaryColor || resolvedSecondaryStyle.backgroundColor,
                      color: activeSubtitle.secondaryColor ? '#ffffff' : resolvedSecondaryStyle.color,
                      fontSize: `${getScaledFontSize(resolvedSecondaryStyle.fontSize)}px`,
                      fontFamily: resolvedSecondaryStyle.fontFamily,
                      borderRadius: '2px',
                      textShadow: activeSubtitle.secondaryColor ? '1px 1px 2px rgba(0,0,0,0.8)' : 'none',
                    }}
                  >
                    {activeSubtitle.secondaryText}
                 </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
