"use client";

import React, { useRef, useEffect, useState } from "react";
import { SubtitleLine, SubtitleConfig, TrackStyle, DEFAULT_GLOBAL_SETTINGS, TimelineClip, VideoClip, TimelineImage, ImageAsset, ProjectConfig } from "@/types/subtitle";
import { resolveTrackStyle, normalizeToPx } from "@/lib/style-resolver";

interface PreviewProps {
  // Legacy support for single video
  videoUrl?: string | null;
  subtitles: SubtitleLine[];
  
  // Multi-video support
  timelineClips?: TimelineClip[];
  videoClips?: VideoClip[];
  timelineImages?: TimelineImage[];
  imageAssets?: ImageAsset[];
  projectConfig?: ProjectConfig;
  
  config: SubtitleConfig;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
}

export function VideoPreview({ 
  videoUrl, 
  subtitles, 
  timelineClips = [], 
  videoClips = [], 
  timelineImages = [],
  imageAssets = [],
  projectConfig,
  config, 
  currentTime, 
  onTimeUpdate, 
  onDurationChange 
}: PreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSubtitle, setActiveSubtitle] = useState<SubtitleLine | null>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  
  // Multi-video state
  const isMultiVideo = timelineClips.length > 0 || timelineImages.length > 0;
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(videoUrl || null);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const lastTimeRef = useRef(currentTime);
  
  // Transcoding State
  const [useTranscoding, setUseTranscoding] = useState(false);
  const [checkingSupport, setCheckingSupport] = useState(false);


  // Multi-clip and Image switching logic
  useEffect(() => {
    if (!isMultiVideo) {
      if (videoUrl !== activeVideoUrl) setActiveVideoUrl(videoUrl || null);
      return;
    }

    // Find what should be visible at currentTime
    const activeVideoClip = timelineClips.find(c => currentTime >= c.projectStartTime && currentTime < c.projectStartTime + c.clipDuration);
    const activeImage = timelineImages.find(i => currentTime >= i.projectStartTime && currentTime < i.projectStartTime + i.duration);

    if (activeVideoClip) {
      const clipInfo = videoClips.find(c => c.id === activeVideoClip.videoClipId);
      if (clipInfo) {
        const fullUrl = `/api/storage?path=${encodeURIComponent(clipInfo.filePath)}`;
        if (fullUrl !== activeVideoUrl) {
          setActiveVideoUrl(fullUrl);
          setActiveImageUrl(null);
          // We need to set the video time appropriately, but let's do it after load
        }
      }
    } else if (activeImage) {
      const asset = imageAssets.find(a => a.id === activeImage.imageAssetId);
      if (asset) {
        const fullUrl = `/api/storage?path=${encodeURIComponent(asset.filePath)}`;
        if (fullUrl !== activeImageUrl) {
          setActiveImageUrl(fullUrl);
          setActiveVideoUrl(null);
        }
      }
    } else {
      // Gap or nothing
      setActiveVideoUrl(null);
      setActiveImageUrl(null);
    }
  }, [currentTime, isMultiVideo, videoUrl, timelineClips, videoClips, timelineImages, imageAssets]);

  // Support check for active video
  useEffect(() => {
    if (!activeVideoUrl) return;
    
    setUseTranscoding(false);
    setCheckingSupport(true);

    const checkSupport = async () => {
        try {
            const ext = activeVideoUrl.split('.').pop()?.split('?')[0]?.toLowerCase(); // Handle query params
            let mime = 'video/mp4'; 
            if (ext === 'mkv') mime = 'video/x-matroska';
            if (ext === 'webm') mime = 'video/webm';
            if (ext === 'mov') mime = 'video/quicktime';
            if (ext === 'avi') mime = 'video/x-msvideo';

            const video = document.createElement('video');
            const canPlay = video.canPlayType(mime);
            
            if (canPlay === '' || mime === 'video/x-matroska') {
                 setUseTranscoding(true);
            }
        } catch (e) {
            console.error("Support check failed:", e);
        } finally {
            setCheckingSupport(false);
        }
    };

    checkSupport();
  }, [activeVideoUrl]);

  // Handle seekers & scrubbing (Project Time -> Local Video Time)
  useEffect(() => {
    if (!videoRef.current || !activeVideoUrl) return;

    if (isMultiVideo) {
       const activeClip = timelineClips.find(c => currentTime >= c.projectStartTime && currentTime < c.projectStartTime + c.clipDuration);
       if (activeClip) {
          const localTime = (currentTime - activeClip.projectStartTime) + activeClip.sourceInPoint;
          // Only seek if difference is significant to avoid stutter
          if (Math.abs(videoRef.current.currentTime - localTime) > 0.3) {
             videoRef.current.currentTime = localTime;
          }
       }
    } else {
       if (Math.abs(videoRef.current.currentTime - currentTime) > 0.3) {
          videoRef.current.currentTime = currentTime;
       }
    }
  }, [currentTime, activeVideoUrl, isMultiVideo, timelineClips]);

  // Timeout-based fallback: if video doesn't load within 5s, use transcoding
  useEffect(() => {
    const urlToCheck = isMultiVideo ? activeVideoUrl : videoUrl;
    if (useTranscoding || !urlToCheck) return;
    
    const timeout = setTimeout(() => {
      if (videoRef.current) {
        if (!videoRef.current.duration || isNaN(videoRef.current.duration)) {
          console.warn('[Preview] Video load timeout - switching to transcoding fallback');
          setUseTranscoding(true);
        }
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [videoUrl, activeVideoUrl, useTranscoding, isMultiVideo]);


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
      if (isMultiVideo) {
        const activeClip = timelineClips.find(c => currentTime >= c.projectStartTime && currentTime < c.projectStartTime + c.clipDuration);
        if (activeClip) {
          const newProjectTime = activeClip.projectStartTime + (videoRef.current.currentTime - activeClip.sourceInPoint);
          // Update global time if it drifted significantly from playback
          if (Math.abs(newProjectTime - currentTime) > 0.1) {
             onTimeUpdate(newProjectTime);
          }
        }
      } else {
        onTimeUpdate(videoRef.current.currentTime);
      }
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
        {activeImageUrl ? (
          <img 
            src={activeImageUrl} 
            className="max-h-[65vh] max-w-full object-contain block mx-auto"
            alt="Timeline Preview"
            style={{ 
              aspectRatio: projectConfig ? `${projectConfig.width}/${projectConfig.height}` : 'auto',
              backgroundColor: '#000'
            }}
          />
        ) : (
          <video
            ref={videoRef}
            src={activeSrc || ""}
            className="max-h-[65vh] max-w-full object-contain block"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            controls
            onError={(e) => {
                console.warn("Video playback error event:", e);
                if (!useTranscoding) {
                    console.log("Playback failed, attempting transcode fallback...");
                    setUseTranscoding(true);
                }
            }}
          />
        )}
        
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
                    textShadow: 'none',
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
                    textShadow: 'none',
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
