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
  
  // Transcoding State
  const [useTranscoding, setUseTranscoding] = useState(false);
  const [checkingSupport, setCheckingSupport] = useState(false);


  // Check if browser supports the source file, otherwise fallback to transcoding
  useEffect(() => {
    if (!videoUrl) return;
    
    // Reset state on new video
    setUseTranscoding(false);
    setCheckingSupport(true);

    const checkSupport = async () => {
        try {
            // 1. Guess mime type from extension (simple)
            const ext = videoUrl.split('.').pop()?.toLowerCase();
            let mime = 'video/mp4'; // default
            if (ext === 'mkv') mime = 'video/x-matroska';
            if (ext === 'webm') mime = 'video/webm';
            if (ext === 'mov') mime = 'video/quicktime';
            if (ext === 'avi') mime = 'video/x-msvideo';

            const video = document.createElement('video');
            const canPlay = video.canPlayType(mime);
            
            console.log(`[Preview] Checking support for ${mime}: '${canPlay}'`);

            // If browser says "no" (empty string) or if it's MKV (often problematic despite "maybe"), 
            // fallback to transcoding.
            if (canPlay === '' || mime === 'video/x-matroska') {
                 console.warn(`[Preview] Format ${mime} unsupported or risky, enabling transcoding.`);
                 setUseTranscoding(true);
            }
        } catch (e) {
            console.error("Support check failed:", e);
        } finally {
            setCheckingSupport(false);
        }
    };

    checkSupport();
  }, [videoUrl]);

  // Timeout-based fallback: if video doesn't load within 5s, use transcoding
  useEffect(() => {
    if (useTranscoding || !videoUrl) return;
    
    const timeout = setTimeout(() => {
      if (videoRef.current) {
        // Check if video has actually loaded (has duration)
        if (!videoRef.current.duration || isNaN(videoRef.current.duration)) {
          console.warn('[Preview] Video load timeout - switching to transcoding fallback');
          setUseTranscoding(true);
        }
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [videoUrl, useTranscoding]);


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

  // Helper to extract raw path
  const getRawPath = (url: string) => {
      try {
          // If relative URL, base doesn't matter much as we only want search params
          const u = new URL(url, 'http://localhost');
          return u.searchParams.get('path');
      } catch { return null; }
  };
 
  const activeSrc = useTranscoding && videoUrl 
     ? `/api/stream?path=${encodeURIComponent(getRawPath(videoUrl) || '')}`
     : videoUrl;

  return (
    <div className="w-full bg-[#000000] flex items-center justify-center overflow-hidden border border-[#333333] shadow-lg p-4">
      <div 
        ref={containerRef}
        className="relative inline-block"
      >
        <video
          ref={videoRef}
          src={activeSrc || ""}
          className="max-h-[65vh] max-w-full object-contain block"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          controls
          onError={(e) => {
              // Auto-fallback on error
              console.warn("Video playback error event:", e);
              if (!useTranscoding) {
                  console.log("Playback failed, attempting transcode fallback...");
                  setUseTranscoding(true);
              }
          }}
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
