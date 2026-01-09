"use client";

import React, { useRef, useEffect, useState } from "react";
import { SubtitleLine, SubtitleConfig, TrackStyle, DEFAULT_GLOBAL_SETTINGS, TimelineClip, VideoClip, TimelineImage, ImageAsset, ProjectConfig } from "@/types/subtitle";
import { REFERENCE_WIDTH } from "@/types/constants";
import { resolveTrackStyle, normalizeToPx } from "@/lib/style-resolver";
import { probeBrowserSupport, isMetadataSupported, BrowserSupport } from "@/lib/browser-support";

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
  videoProperties?: any; // Added to pass probed metadata
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
  onDurationChange,
  videoProperties
}: PreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSubtitle, setActiveSubtitle] = useState<SubtitleLine | null>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  
  // Multi-video state
  const isMultiVideo = timelineClips.length > 0 || timelineImages.length > 0;
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(videoUrl || null);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [activeMetadata, setActiveMetadata] = useState<any>(null);
  
  // Browser Support & Transcoding State
  const [browserSupport, setBrowserSupport] = useState<BrowserSupport | null>(null);
  const [useTranscoding, setUseTranscoding] = useState(false);
  const [checkingSupport, setCheckingSupport] = useState(true); // Start true - block until checked
  const [metadataReady, setMetadataReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false); // True only when video can play

  // Initialize browser support probe
  useEffect(() => {
    probeBrowserSupport().then(setBrowserSupport);
  }, []);

  // Helper to extract raw path from URL (must be before effects that use it)
  const getRawPath = (url: string) => {
      try {
          const u = new URL(url, 'http://localhost');
          return u.searchParams.get('path');
      } catch { return null; }
  };

  // Multi-clip and Image switching logic
  useEffect(() => {
    if (!isMultiVideo) {
      if (videoUrl !== activeVideoUrl) setActiveVideoUrl(videoUrl || null);
      setActiveMetadata(videoProperties);
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
          // Fetch metadata for this clip if we don't have it
          fetch(`/api/video-info?path=${encodeURIComponent(clipInfo.filePath)}`)
            .then(res => res.json())
            .then(setActiveMetadata)
            .catch(() => setActiveMetadata(null));
        }
      }
    } else if (activeImage) {
      const asset = imageAssets.find(a => a.id === activeImage.imageAssetId);
      if (asset) {
        const fullUrl = `/api/storage?path=${encodeURIComponent(asset.filePath)}`;
        if (fullUrl !== activeImageUrl) {
          setActiveImageUrl(fullUrl);
          setActiveVideoUrl(null);
          setActiveMetadata(null);
        }
      }
    } else {
      // Gap or nothing
      setActiveVideoUrl(null);
      setActiveImageUrl(null);
      setActiveMetadata(null);
    }
  }, [currentTime, isMultiVideo, videoUrl, timelineClips, videoClips, timelineImages, imageAssets, videoProperties, activeVideoUrl]);

  // Support check for active video - runs BEFORE video plays
  // Key: only run when URL changes, not when metadata changes (to avoid re-runs)
  useEffect(() => {
    if (!activeVideoUrl) {
        setMetadataReady(true); // No URL = nothing to check
        setCheckingSupport(false);
        return;
    }
    if (!browserSupport) return; // Wait for browser probe
    
    // Block video load until we complete the check
    setCheckingSupport(true);
    setMetadataReady(false);
    setVideoReady(false); // Reset for new source

    const checkSupport = async () => {
        try {
            // Fetch metadata if not already available
            let metadata = activeMetadata;
            if (!metadata && !isMultiVideo) {
                const rawPath = getRawPath(activeVideoUrl);
                if (rawPath) {
                    try {
                        const res = await fetch(`/api/video-info?path=${encodeURIComponent(rawPath)}`);
                        if (res.ok) {
                            metadata = await res.json();
                            setActiveMetadata(metadata);
                        }
                    } catch (e) {
                        console.warn('[Preview] Failed to fetch metadata:', e);
                    }
                }
            }

            // Determine transcoding requirement
            let needsTranscoding = false;
            
            if (metadata?.videoCodec) {
                const codec = metadata.videoCodec.toLowerCase();
                // HEVC/H.265 check
                if ((codec === 'hevc' || codec === 'h265' || codec.includes('hev1') || codec.includes('hvc1')) && !browserSupport.hevc) {
                    console.log(`[Preview] HEVC detected, browser doesn't support. Using transcoding.`);
                    needsTranscoding = true;
                } else {
                    const supported = isMetadataSupported(metadata, browserSupport);
                    if (!supported) {
                        console.log(`[Preview] Unsupported format (${metadata.videoCodec}/${metadata.pixFmt}). Using transcoding.`);
                        needsTranscoding = true;
                    }
                }
            }

            // Extension-based fallback
            if (!needsTranscoding) {
                const ext = activeVideoUrl.split('.').pop()?.split('?')[0]?.toLowerCase();
                if (ext === 'mkv' || ext === 'avi' || ext === 'hevc' || ext === 'h265') {
                    console.log(`[Preview] Container ${ext} typically needs transcoding.`);
                    needsTranscoding = true;
                } else {
                    // Quick canPlayType check
                    let mime = 'video/mp4';
                    if (ext === 'webm') mime = 'video/webm';
                    if (ext === 'mov') mime = 'video/quicktime';
                    const testVideo = document.createElement('video');
                    if (testVideo.canPlayType(mime) === '') {
                        console.log(`[Preview] Browser cannot play ${mime}. Using transcoding.`);
                        needsTranscoding = true;
                    }
                }
            }

            // Set final state - this happens ONCE
            setUseTranscoding(needsTranscoding);
            setMetadataReady(true);
        } catch (e) {
            console.error("Support check failed:", e);
            setUseTranscoding(true); // Safe fallback
            setMetadataReady(true);
        } finally {
            setCheckingSupport(false);
        }
    };

    checkSupport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVideoUrl, browserSupport]); // Removed activeMetadata to prevent re-runs

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
    const pxMarginH = normalizeToPx(marginH, REFERENCE_WIDTH); // horizontal uses width ref
    
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

  // getRawPath moved to line 64 (before effects)
 
  const activeSrc = !metadataReady ? undefined : (useTranscoding && videoUrl 
     ? `/api/stream?path=${encodeURIComponent(getRawPath(videoUrl) || '')}`
     : videoUrl);

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
          <>
            {/* Container with proper aspect ratio from metadata */}
            <div 
              className="relative bg-black flex items-center justify-center"
              style={{
                aspectRatio: activeMetadata?.width && activeMetadata?.height 
                  ? `${activeMetadata.width}/${activeMetadata.height}` 
                  : projectConfig 
                    ? `${projectConfig.width}/${projectConfig.height}` 
                    : '16/9',
                maxHeight: '65vh',
                width: '100%',
                maxWidth: activeMetadata?.width && activeMetadata?.height
                  ? `calc(65vh * ${activeMetadata.width / activeMetadata.height})`
                  : projectConfig
                    ? `calc(65vh * ${projectConfig.width / projectConfig.height})`
                    : 'calc(65vh * 16 / 9)',
              }}
            >
              {/* Custom Loading Spinner - shown until video is ready */}
              {(!videoReady || !activeSrc) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black">
                  <div className="w-8 h-8 border-2 border-[#007acc] border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-[11px] text-[#666]">
                    {!metadataReady ? 'Checking format...' : 'Loading video...'}
                  </span>
                </div>
              )}
              
              {/* Video element - hidden until ready, loads in background */}
              {activeSrc && (
                <video
                  ref={videoRef}
                  src={activeSrc}
                  className={`w-full h-full object-contain ${videoReady ? 'opacity-100' : 'opacity-0'}`}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onCanPlay={() => setVideoReady(true)}
                  onError={(e) => {
                    console.warn("Video playback error:", e);
                    if (!useTranscoding) {
                      console.log("Playback failed, attempting transcode fallback...");
                      setVideoReady(false);
                      setUseTranscoding(true);
                    }
                  }}
                  controls={videoReady}
                />
              )}
            </div>
          </>
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
