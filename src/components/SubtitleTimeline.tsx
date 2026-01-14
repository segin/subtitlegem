"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { SubtitleLine, VideoClip, TimelineClip } from "@/types/subtitle";
import { AlertCircle } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// Types
// ============================================================================

interface TimelineProps {
  // Subtitles
  subtitles: SubtitleLine[];
  onSubtitlesUpdate: (updatedSubtitles: SubtitleLine[]) => void;
  
  // Time control
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  
  // Selection (shared with SubtitleList)
  selectedIds: string[];
  onSelect: (id: string, shiftKey: boolean, ctrlKey: boolean) => void;
  onSplit: (id: string) => void;
  
  // Multi-video support (optional - V2 mode)
  videoClips?: VideoClip[];
  timelineClips?: TimelineClip[];
  onTimelineClipsUpdate?: (clips: TimelineClip[]) => void;
  selectedClipId?: string | null;
  onClipSelect?: (clipId: string | null) => void;
  
  // Images
  imageAssets?: import("@/types/subtitle").ImageAsset[];
  timelineImages?: import("@/types/subtitle").TimelineImage[];
  onTimelineImagesUpdate?: (images: import("@/types/subtitle").TimelineImage[]) => void;
  selectedImageId?: string | null;
  onImageSelect?: (imageId: string | null) => void;
  
  // Advanced operations
  onDuplicateClip?: (id: string, type: 'video' | 'image') => void;
  onSplitClip?: (id: string, time: number) => void;
  onRemoveTimelineItem?: (id: string, type: 'video' | 'image') => void;
  // Read-Only mode (e.g. for previews)
  readOnly?: boolean;
}

// Legacy props for backwards compatibility
interface LegacyTimelineProps {
  subtitles: SubtitleLine[];
  duration: number;
  onUpdate: (updatedSubtitles: SubtitleLine[]) => void;
  currentTime: number;
  onSeek: (time: number) => void;
  selectedIds: string[];
  onSelect: (id: string, shiftKey: boolean, ctrlKey: boolean) => void;
  readOnly?: boolean;
  onSplit: (id: string) => void;
}

// Union type for both props
type SubtitleTimelineProps = TimelineProps | LegacyTimelineProps;

// Type guard
function isLegacyProps(props: SubtitleTimelineProps): props is LegacyTimelineProps {
  return 'onUpdate' in props && !('onSubtitlesUpdate' in props);
}

// ============================================================================
// Main Component
// ============================================================================

export type TimelineRef = {
  zoomIn: () => void;
  zoomOut: () => void;
};

export const SubtitleTimeline = React.forwardRef<TimelineRef, SubtitleTimelineProps>((props, ref) => {
  // Normalize props to new interface
  const subtitles = props.subtitles;
  const onSubtitlesUpdate = isLegacyProps(props) ? props.onUpdate : props.onSubtitlesUpdate;
  const { duration, currentTime, onSeek, selectedIds, onSelect, onSplit } = props;
  
  // V2 multi-video props
  const videoClips = isLegacyProps(props) ? undefined : props.videoClips;
  const timelineClips = isLegacyProps(props) ? undefined : props.timelineClips;
  const onTimelineClipsUpdate = isLegacyProps(props) ? undefined : props.onTimelineClipsUpdate;
  const selectedClipId = isLegacyProps(props) ? null : props.selectedClipId;
  const onClipSelect = isLegacyProps(props) ? undefined : props.onClipSelect;

  const imageAssets = isLegacyProps(props) ? undefined : props.imageAssets;
  const timelineImages = isLegacyProps(props) ? undefined : props.timelineImages;
  const onTimelineImagesUpdate = isLegacyProps(props) ? undefined : props.onTimelineImagesUpdate;
  const selectedImageId = isLegacyProps(props) ? null : props.selectedImageId;
  const onImageSelect = isLegacyProps(props) ? undefined : props.onImageSelect;

  const onDuplicateClip = isLegacyProps(props) ? undefined : props.onDuplicateClip;
  const onSplitClip = isLegacyProps(props) ? undefined : props.onSplitClip;
  const onRemoveTimelineItem = isLegacyProps(props) ? undefined : props.onRemoveTimelineItem;
  
  const isMultiVideoMode = videoClips && timelineClips && timelineClips.length > 0;

  const containerRef = useRef<HTMLDivElement>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(100);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [followPlayhead, setFollowPlayhead] = useState(true);
  const [isV2Collapsed, setIsV2Collapsed] = useState(false);
  
  // Context Menu state
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerTransition = useCallback(() => {
    setIsTransitioning(true);
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = setTimeout(() => setIsTransitioning(false), 300);
  }, []);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetId: string;
    targetType: 'video' | 'image';
  } | null>(null);
  const [snappingEnabled, setSnappingEnabled] = useState(true);

  // Preview states for dragging (optimistic updates)
  // Maps ID -> New State properties
  const [subtitlePreview, setSubtitlePreview] = useState<Record<string, { startTime: number, endTime: number }>>({});
  const [clipPreview, setClipPreview] = useState<Record<string, { projectStartTime: number, sourceInPoint: number, clipDuration: number }>>({});
  const [imagePreview, setImagePreview] = useState<Record<string, { projectStartTime: number, duration: number }>>({});

  // Snapping helper: snaps time to playhead, other boundaries, or 1s intervals
  const getSnappedTime = useCallback((time: number, excludeId?: string) => {
    if (!snappingEnabled) return time;
    
    // We snap to existing commit state of other items
    const threshold = 10 / pixelsPerSecond; // 10 pixels threshold
    const snapTargets = [
      0,
      duration,
      currentTime,
      ...subtitles.filter(s => s.id !== excludeId).flatMap(s => [s.startTime, s.endTime]),
      ...(timelineClips?.filter(c => c.id !== excludeId).flatMap(c => [c.projectStartTime, c.projectStartTime + c.clipDuration]) || []),
      ...(timelineImages?.filter(i => i.id !== excludeId).flatMap(i => [i.projectStartTime, i.projectStartTime + i.duration]) || [])
    ];
    
    let closestSnap = time;
    let minDiff = threshold;
    
    for (const target of snapTargets) {
      const diff = Math.abs(time - target);
      if (diff < minDiff) {
        minDiff = diff;
        closestSnap = target;
      }
    }
    
    return closestSnap;
  }, [snappingEnabled, pixelsPerSecond, duration, currentTime, subtitles, timelineClips, timelineImages]);

  // Subtitle drag handler (Preview)
  const handleSubtitleDrag = useCallback((id: string, side: 'left' | 'right' | 'both', deltaX: number) => {
    const deltaSeconds = deltaX / pixelsPerSecond;
    const sub = subtitles.find(s => s.id === id); // Original
    if (!sub) return;
    
    // Always calculate from Original (sub) + Cumulative Delta
    // This allows breaking out of snaps with large enough movements

    let newStart = sub.startTime;
    let newEnd = sub.endTime;

    if (side === 'left' || side === 'both') {
      newStart = getSnappedTime(sub.startTime + deltaSeconds, id);
      if (side === 'both') {
        const duration = sub.endTime - sub.startTime;
        newEnd = newStart + duration;
      }
    } else if (side === 'right') {
      newEnd = getSnappedTime(sub.endTime + deltaSeconds, id);
    }

    // Prevent negative duration or out of bounds
    newStart = Math.max(0, newStart);
    newEnd = Math.min(duration, newEnd);
    if (newEnd - newStart < 0.1) return;

    setSubtitlePreview(prev => ({
      ...prev,
      [id]: { startTime: newStart, endTime: newEnd }
    }));
  }, [subtitles, pixelsPerSecond, duration, getSnappedTime]);

  // Subtitle drop handler (Commit)
  const handleSubtitleDrop = useCallback((id: string) => {
    const preview = subtitlePreview[id];
    // Only commit if we have a valid preview change
    if (preview) {
      const newSubtitles = subtitles.map(s => s.id === id ? { ...s, ...preview } : s);
      onSubtitlesUpdate(newSubtitles);
      setSubtitlePreview(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, [subtitlePreview, subtitles, onSubtitlesUpdate]);

  // Video clip drag handler (Preview)
  const handleClipDrag = useCallback((clipId: string, side: 'left' | 'right' | 'both', deltaX: number) => {
    if (!timelineClips) return;
    
    const deltaSeconds = deltaX / pixelsPerSecond;
    const currentClip = timelineClips.find(c => c.id === clipId); // Original
    if (!currentClip) return;

    let newStart = currentClip.projectStartTime;
    let newDuration = currentClip.clipDuration;
    let newInPoint = currentClip.sourceInPoint;

    if (side === 'both') {
      newStart = getSnappedTime(currentClip.projectStartTime + deltaSeconds, clipId);
    } else if (side === 'left') {
      const snappedStart = getSnappedTime(currentClip.projectStartTime + deltaSeconds, clipId);
      const adjustment = snappedStart - currentClip.projectStartTime;
      newInPoint = Math.max(0, currentClip.sourceInPoint + adjustment);
      newDuration = Math.max(0.1, currentClip.clipDuration - adjustment);
      newStart = snappedStart;
    } else if (side === 'right') {
      const newEndTime = getSnappedTime(currentClip.projectStartTime + currentClip.clipDuration + deltaSeconds, clipId);
      newDuration = Math.max(0.1, newEndTime - currentClip.projectStartTime);
    }

    setClipPreview(prev => ({
      ...prev,
      [clipId]: { 
        projectStartTime: Math.max(0, newStart), 
        sourceInPoint: newInPoint, 
        clipDuration: newDuration 
      }
    }));
  }, [timelineClips, pixelsPerSecond, getSnappedTime]);

  // Video clip drop handler (Commit)
  const handleClipDrop = useCallback((clipId: string) => {
    if (!timelineClips || !onTimelineClipsUpdate) return;
    const preview = clipPreview[clipId];
    if (preview) {
      const newClips = timelineClips.map(clip => 
        clip.id === clipId ? { ...clip, ...preview } : clip
      );
      onTimelineClipsUpdate(newClips);
      setClipPreview(prev => {
        const next = { ...prev };
        delete next[clipId];
        return next;
      });
    }
  }, [clipPreview, timelineClips, onTimelineClipsUpdate]);


  // Image clip drag handler (Preview)
  const handleImageDrag = useCallback((id: string, side: 'left' | 'right' | 'both', deltaX: number) => {
    if (!timelineImages) return;
    const deltaSeconds = deltaX / pixelsPerSecond;
    const img = timelineImages.find(i => i.id === id);
    if (!img) return;

    let newStart = img.projectStartTime;
    let newDur = img.duration;

    if (side === 'both') {
      newStart = getSnappedTime(img.projectStartTime + deltaSeconds, id);
    } else if (side === 'left') {
      newStart = getSnappedTime(img.projectStartTime + deltaSeconds, id);
      newDur = Math.max(0.1, img.duration - (newStart - img.projectStartTime));
    } else if (side === 'right') {
      const newEnd = getSnappedTime(img.projectStartTime + img.duration + deltaSeconds, id);
      newDur = Math.max(0.1, newEnd - img.projectStartTime);
    }

    setImagePreview(prev => ({
      ...prev,
      [id]: { projectStartTime: Math.max(0, newStart), duration: newDur }
    }));
  }, [timelineImages, pixelsPerSecond, getSnappedTime]);

  // Image clip drop handler (Commit)
  const handleImageDrop = useCallback((id: string) => {
    if (!timelineImages || !onTimelineImagesUpdate) return;
    const preview = imagePreview[id];
    if (preview) {
      const newImages = timelineImages.map(i => 
        i.id === id ? { ...i, ...preview } : i
      );
      onTimelineImagesUpdate(newImages);
      setImagePreview(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, [imagePreview, timelineImages, onTimelineImagesUpdate]);


  // Seek to position based on mouse X
  // Track label width for offset calculations
  const TRACK_LABEL_WIDTH_SEEK = 64; // w-16 = 4rem = 64px
  
  const seekFromEvent = useCallback((e: React.MouseEvent | MouseEvent, rect: DOMRect) => {
    const x = (e as MouseEvent).clientX - rect.left - TRACK_LABEL_WIDTH_SEEK;
    const time = Math.max(0, Math.min(duration, x / pixelsPerSecond));
    onSeek(time);
  }, [duration, pixelsPerSecond, onSeek]);

  // Handle native wheel for zoom prevention and smooth transitions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        // Zoom
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        triggerTransition();
        setPixelsPerSecond(prev => {
          const next = Math.max(20, Math.min(400, prev * zoomFactor));
          return next;
        });
      } else {
        // Convert vertical scroll to horizontal scroll
        const scrollAmount = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        if (scrollAmount !== 0) {
          // We don't preventDefault here to allow standard scroll behavior if desired,
          // but for horizontal-only timeline, converting Y to X is standard.
          container.scrollLeft += scrollAmount;
          // Note: if we want to block browser 'back' on trackpad, e.preventDefault() here.
        }
      }
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleNativeWheel);
  }, [triggerTransition]);

  // Handle scrubbing globally
  useEffect(() => {
    if (!isScrubbing) return;

    const timelineEl = containerRef.current?.querySelector('[data-timeline-bg]') as HTMLElement;
    if (!timelineEl) return;

    const rect = timelineEl.getBoundingClientRect();

    const handleMouseMove = (e: MouseEvent) => {
      seekFromEvent(e, rect);
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, seekFromEvent]);

  // Track heights and label width
  const RULER_HEIGHT = 24;
  const TRACK_LABEL_WIDTH = 64; 
  
  const V2_ENABLED = isMultiVideoMode && !isV2Collapsed;
  const VIDEO_TRACK_HEIGHT = 48;
  const AUDIO_TRACK_HEIGHT = 48;
  const SUBTITLE_TRACK_HEIGHT = 48;
  
  const TOTAL_TRACKS_HEIGHT = 
    (V2_ENABLED ? VIDEO_TRACK_HEIGHT + AUDIO_TRACK_HEIGHT + 16 : 0) + 
    VIDEO_TRACK_HEIGHT + AUDIO_TRACK_HEIGHT + SUBTITLE_TRACK_HEIGHT + 24;
  
  // Zoom handlers
  const handleZoomIn = () => {
    triggerTransition();
    setPixelsPerSecond(prev => Math.min(10000, prev * 1.2));
  };
  const handleZoomOut = () => {
    triggerTransition();
    setPixelsPerSecond(prev => Math.max(0.1, prev * 0.8));
  };

  React.useImperativeHandle(ref, () => ({
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
  }));
  
  // Fit to View: Calculate zoom level to fit entire duration in visible area
  const handleFitToView = useCallback(() => {
    if (!containerRef.current || duration <= 0) return;
    const containerWidth = containerRef.current.clientWidth - 100; // Subtract labels + margin
    const newPPS = Math.max(0.1, Math.min(10000, containerWidth / duration));
    setPixelsPerSecond(newPPS);
    containerRef.current.scrollLeft = 0;
  }, [duration]);
  
  // Keyboard shortcuts for zoom (+/-)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '=' || e.key === '+') { handleZoomIn(); }
      if (e.key === '-') { handleZoomOut(); }
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleFitToView(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFitToView]);
  
  // Auto-scroll to keep playhead visible
  useEffect(() => {
    if (!followPlayhead || !containerRef.current || isScrubbing) return;
    const container = containerRef.current;
    const playheadX = TRACK_LABEL_WIDTH + currentTime * pixelsPerSecond;
    const scrollLeft = container.scrollLeft;
    const visibleWidth = container.clientWidth;
    // Scroll if playhead is outside visible area (with margin)
    // Only auto-scroll if NOT transitioning (to avoid competing animations)
    if (isTransitioning) return;
    const margin = 100;
    if (playheadX < scrollLeft + margin || playheadX > scrollLeft + visibleWidth - margin) {
      // scrollTo may not be available in test environment (JSDOM)
      if (container.scrollTo) {
        container.scrollTo({ left: playheadX - visibleWidth / 3, behavior: 'smooth' });
      }
    }
  }, [currentTime, pixelsPerSecond, followPlayhead, isScrubbing]);
  
  const handleContextMenu = (e: React.MouseEvent, id: string, type: 'video' | 'image') => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetId: id,
      targetType: type
    });
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#1e1e1e]">
      {/* Timeline Controls Overlay */}
      <div className="absolute top-2 right-4 z-40 flex items-center space-x-1 bg-[#252526] px-2 py-1 rounded shadow-md border border-[#333333]">
         <button 
           onClick={handleZoomOut}
           className="p-1 hover:bg-[#3e3e42] rounded text-[#cccccc]"
           title="Zoom Out (-)"
         >
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
         </button>
         <span className="text-[10px] text-[#888888] font-mono min-w-[32px] text-center">
            {Math.round((pixelsPerSecond / 100) * 100)}%
         </span>
         <button 
           onClick={handleZoomIn}
           className="p-1 hover:bg-[#3e3e42] rounded text-[#cccccc]"
           title="Zoom In (+)"
         >
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
         </button>
         <div className="w-px h-4 bg-[#444444] mx-1" />
         <button 
           onClick={handleFitToView}
           className="px-1.5 py-0.5 text-[10px] hover:bg-[#3e3e42] rounded text-[#cccccc]"
           title="Fit to View (Ctrl+0)"
         >
           Fit
         </button>
         <button 
           onClick={() => setFollowPlayhead(!followPlayhead)}
           className={`px-1.5 py-0.5 text-[10px] rounded ${followPlayhead ? 'bg-[#264f78] text-white' : 'text-[#888888] hover:bg-[#3e3e42]'}`}
           title="Auto-follow playhead"
         >
           Follow
         </button>
      </div>

      <div 
        ref={containerRef} 
        className={cn(
          "flex-1 w-full bg-[#1e1e1e] overflow-x-auto overflow-y-hidden relative custom-scrollbar select-none",
          isTransitioning && !isScrubbing && "timeline-transitioning"
        )}
      >
      <div 
        data-timeline-bg
        className="relative h-full min-w-full cursor-pointer" 
        style={{ 
          width: `${Math.max(duration * pixelsPerSecond, 1000)}px`,
          minHeight: `${RULER_HEIGHT + TOTAL_TRACKS_HEIGHT}px`
        }}
        onMouseDown={(e) => {
          // Only start scrubbing if not clicking on a bubble/clip
          if ((e.target as HTMLElement).closest('[data-draggable]')) return;
          const rect = e.currentTarget.getBoundingClientRect();
          seekFromEvent(e, rect);
          setIsScrubbing(true);
        }}
      >
        {/* Time Ruler */}
        <TimeRuler duration={duration} pixelsPerSecond={pixelsPerSecond} />

        {/* Playhead Line */}
        <div 
          data-playhead
          className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none"
          style={{ left: `${TRACK_LABEL_WIDTH + currentTime * pixelsPerSecond}px` }}
        >
          <div className="absolute top-0 -left-1.5 w-3 h-3 bg-red-500" style={{ clipPath: 'polygon(50% 100%, 0% 0%, 100% 0%)' }} />
        </div>

        {/* Tracks Container */}
        <div className="relative">
          
          {/* TRACK ORDER: Audio 2, Video 2, Video 1, Audio 1, Subs */}

          {/* Audio 2 & Video 2 (Conditional) */}
          {V2_ENABLED && (
            <>
              {/* Audio 2 */}
              <div className="relative" style={{ height: AUDIO_TRACK_HEIGHT }}>
                <div className="absolute left-0 top-0 bottom-0 w-16 bg-[#252526] border-r border-[#333333] flex flex-col items-center justify-center z-10">
                  <span className="text-[8px] text-[#555555]">AUDIO 2</span>
                  <button onClick={() => setIsV2Collapsed(true)} title="Collapse V2" className="mt-1 hover:text-white transition-colors">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                  </button>
                </div>
                <div className="ml-16 relative h-full">
                  {/* Future: Audio 2 content */}
                </div>
              </div>

              {/* Video 2 */}
              <div className="relative" style={{ height: VIDEO_TRACK_HEIGHT, marginTop: 4 }}>
                <div className="absolute left-0 top-0 bottom-0 w-16 bg-[#252526] border-r border-[#333333] flex items-center justify-center z-10">
                  <span className="text-[8px] text-[#555555]">VIDEO 2</span>
                </div>
                <div className="ml-16 relative h-full">
                  {/* Future: Video 2 content (overlays) */}
                </div>
              </div>
              <div className="h-4" /> {/* Gap between V2 and V1 */}
            </>
          )}

          {/* V2 Collapsed Indicator */}
          {isMultiVideoMode && isV2Collapsed && (
             <div className="h-6 relative border-b border-[#333333] bg-[#1a1a1b] flex items-center">
                <div className="absolute left-0 top-0 bottom-0 w-16 bg-[#252526] border-r border-[#333333] flex items-center justify-center z-10">
                   <button onClick={() => setIsV2Collapsed(false)} title="Expand V2" className="hover:text-white transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                   </button>
                </div>
                <span className="ml-20 text-[9px] text-[#444444] uppercase tracking-widest font-bold">V2 Tracks Collapsed</span>
             </div>
          )}

          {/* Video 1 (Main) */}
          <div className="relative" style={{ height: VIDEO_TRACK_HEIGHT, marginTop: 4 }}>
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-[#252526] border-r border-[#333333] flex items-center justify-center z-10">
              <span className="text-[10px] text-[#888888] font-medium">{isMultiVideoMode ? 'VIDEO 1' : 'VIDEO'}</span>
            </div>
            <div className="ml-16 relative h-full">
              {isMultiVideoMode && videoClips && timelineClips?.map(clip => {
                const videoClip = videoClips.find(v => v.id === clip.videoClipId);
                if (!videoClip) return null;
                const preview = clipPreview[clip.id];
                const displayClip = preview ? { ...clip, ...preview } : clip;
                return (
                  <VideoClipBlock
                    key={clip.id}
                    clip={displayClip}
                    videoClip={videoClip}
                    pixelsPerSecond={pixelsPerSecond}
                    selected={selectedClipId === clip.id}
                    onDrag={(side, deltaX) => handleClipDrag(clip.id, side, deltaX)}
                    onDrop={() => handleClipDrop(clip.id)}
                    onClick={() => onClipSelect?.(clip.id)}
                    onContextMenu={(e) => handleContextMenu(e, clip.id, 'video')}
                  />
                );
              })}

              {/* Timeline Images (mapped to Video 1 for now) */}
              {isMultiVideoMode && timelineImages?.map(img => {
                const asset = imageAssets?.find(a => a.id === img.imageAssetId);
                if (!asset) return null;
                const preview = imagePreview[img.id];
                const displayImg = preview ? { ...img, ...preview } : img;
                return (
                  <ImageClipBlock
                    key={img.id}
                    item={displayImg}
                    asset={asset}
                    pixelsPerSecond={pixelsPerSecond}
                    selected={selectedImageId === img.id}
                    onDrag={(side, deltaX) => handleImageDrag(img.id, side, deltaX)}
                    onDrop={() => handleImageDrop(img.id)}
                    onClick={() => onImageSelect?.(img.id)}
                    onContextMenu={(e) => handleContextMenu(e, img.id, 'image')}
                  />
                );
              })}
            </div>
          </div>

          {/* Audio 1 (Linked) */}
          <div className="relative" style={{ height: AUDIO_TRACK_HEIGHT, marginTop: 8 }}>
             <div className="absolute left-0 top-0 bottom-0 w-16 bg-[#252526] border-r border-[#333333] flex items-center justify-center z-10">
               <span className="text-[10px] text-[#888888] font-medium">{isMultiVideoMode ? 'AUDIO 1' : 'AUDIO'}</span>
             </div>
             <div className="ml-16 relative h-full">
                {isMultiVideoMode && timelineClips?.map(clip => {
                  const preview = clipPreview[clip.id];
                  const displayClip = preview ? { ...clip, ...preview } : clip;
                  return (
                    <AudioClipBlock
                      key={`audio-${clip.id}`}
                      clip={displayClip}
                      pixelsPerSecond={pixelsPerSecond}
                      selected={selectedClipId === clip.id}
                      onContextMenu={(e) => handleContextMenu(e, clip.id, 'video')}
                    />
                  );
                })}
             </div>
          </div>

          {/* Subtitle Track */}
          <div className="relative" style={{ height: SUBTITLE_TRACK_HEIGHT, marginTop: 8 }}>
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-[#252526] border-r border-[#333333] flex items-center justify-center z-10">
              <span className="text-[10px] text-[#888888] font-medium">SUBS</span>
            </div>
            <div 
              className="ml-16 relative h-full px-0"
              onClick={() => onSelect("", false, false)}
            >
              {subtitles.map((sub) => {
                const preview = subtitlePreview[sub.id];
                const displaySub = preview ? { ...sub, ...preview } : sub;
                return (
                  <SubtitleBubble 
                    key={sub.id} 
                    subtitle={displaySub} 
                    pixelsPerSecond={pixelsPerSecond}
                    onDrag={(side, deltaX) => handleSubtitleDrag(sub.id, side, deltaX)}
                    onDrop={() => handleSubtitleDrop(sub.id)}
                    active={currentTime >= displaySub.startTime && currentTime <= displaySub.endTime}
                    selected={selectedIds.includes(sub.id)}
                    onClick={(e) => onSelect(sub.id, e.shiftKey, e.ctrlKey || e.metaKey)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
});

SubtitleTimeline.displayName = "SubtitleTimeline";

// ============================================================================
// Time Ruler
// ============================================================================

function TimeRuler({ duration, pixelsPerSecond }: { duration: number; pixelsPerSecond: number }) {
  const TRACK_LABEL_WIDTH = 64; // w-16 = 4rem = 64px
  return (
    <div className="relative h-6 bg-[#252526] border-b border-[#333333] flex items-end select-none z-20">
      {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
        <div 
          key={i} 
          data-ruler-tick
          className="absolute bottom-0 h-2 border-l border-[#555555] text-[9px] text-[#888888] pl-1 font-mono"
          style={{ left: `${TRACK_LABEL_WIDTH + i * pixelsPerSecond}px` }}
        >
          {i % 5 === 0 && <span>{new Date(i * 1000).toISOString().substr(14, 5)}</span>}
        </div>
      ))}
      {/* Sub-ticks */}
      {Array.from({ length: Math.ceil(duration * 2) + 1 }).map((_, i) => (
        <div 
          key={`sub-${i}`}
          className="absolute bottom-0 h-1 border-l border-[#333333]"
          style={{ left: `${TRACK_LABEL_WIDTH + i * (pixelsPerSecond / 2)}px` }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Video Clip Block
// ============================================================================

function VideoClipBlock({ clip, videoClip, pixelsPerSecond, selected, onDrag, onDrop, onClick, onContextMenu }: {
  clip: TimelineClip;
  videoClip: VideoClip;
  pixelsPerSecond: number;
  selected: boolean;
  onDrag: (side: 'left' | 'right' | 'both', deltaX: number) => void;
  onDrop: () => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const [isDragging, setIsDragging] = useState<'left' | 'right' | 'both' | null>(null);
  const [originalClip, setOriginalClip] = useState<TimelineClip | null>(null);
  const startX = useRef(0);

  const handleMouseDown = (e: React.MouseEvent, side: 'left' | 'right' | 'both') => {
    e.stopPropagation();
    setIsDragging(side);
    setOriginalClip({ ...clip });
    startX.current = e.clientX;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX.current;
      onDrag(isDragging, deltaX);
      // NOTE: We do NOT reset startX here.
      // This means deltaX is CUMULATIVE from the start of the drag.
      // This allows the parent to calculate positioning relative to the original start time.
    };

    const handleMouseUp = () => {
      setIsDragging(null);
      setOriginalClip(null);
      onDrop();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onDrag, onDrop]);

  return (
    <div 
      data-draggable
      className={cn(
        "absolute top-1 bottom-1 cursor-move flex items-center px-2 overflow-hidden select-none group transition-colors rounded-sm",
        selected
          ? "bg-[#264f78] ring-2 ring-[#007acc] text-white z-10"
          : videoClip.missing 
            ? "bg-red-950/50 border border-red-800 text-red-200 hover:bg-red-900/50"
            : "bg-[#3d5c3d] border border-[#4a704a] text-[#cccccc] hover:bg-[#4a704a]",
        isDragging && "ring-1 ring-white z-20"
      )}
      style={{ 
        left: `${clip.projectStartTime * pixelsPerSecond}px`, 
        width: `${Math.max(clip.clipDuration * pixelsPerSecond, 20)}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={(e) => handleMouseDown(e, 'both')}
      onContextMenu={onContextMenu}
    >
      {/* Ghost Representation */}
      {isDragging && originalClip && (
        <div 
          className="absolute inset-y-0 opacity-20 bg-white border border-white/50 pointer-events-none z-0 rounded-sm"
          style={{ 
            left: `${(originalClip.projectStartTime - clip.projectStartTime) * pixelsPerSecond}px`, 
            width: `${originalClip.clipDuration * pixelsPerSecond}px` 
          }}
        />
      )}

      {/* Dragging Tooltip */}
      {isDragging && (
        <div className="absolute -top-6 left-0 bg-[#007acc] text-white text-[9px] px-1 rounded shadow-lg z-50 whitespace-nowrap font-mono py-0.5">
           {isDragging === 'both' ? formatTime(clip.projectStartTime) : formatTime(clip.clipDuration)}
        </div>
      )}
      {/* Clip content */}
      <div className="flex-1 min-w-0 relative">
        <div className="text-[10px] font-medium truncate pointer-events-none">
          {videoClip.originalFilename}
        </div>
        <div className="text-[8px] opacity-60 pointer-events-none">
          {formatTime(clip.sourceInPoint)} - {formatTime(clip.sourceInPoint + clip.clipDuration)}
        </div>
        {videoClip.missing && (
           <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30">
              <AlertCircle className="w-4 h-4 text-red-500 mr-1" />
              <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider">MISSING</span>
           </div>
        )}
      </div>
      
      {/* Resize handles */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 z-20 opacity-0 group-hover:opacity-100 transition-opacity" 
        onMouseDown={(e) => handleMouseDown(e, 'left')}
      />
      <div 
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 z-20 opacity-0 group-hover:opacity-100 transition-opacity" 
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      />
    </div>
  );
}

// ============================================================================
// Image Clip Block
// ============================================================================

function ImageClipBlock({ item, asset, pixelsPerSecond, selected, onDrag, onDrop, onClick, onContextMenu }: {
  item: import("@/types/subtitle").TimelineImage;
  asset: import("@/types/subtitle").ImageAsset;
  pixelsPerSecond: number;
  selected: boolean;
  onDrag: (side: 'left' | 'right' | 'both', deltaX: number) => void;
  onDrop: () => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const [isDragging, setIsDragging] = useState<'left' | 'right' | 'both' | null>(null);
  const [originalItem, setOriginalItem] = useState<import("@/types/subtitle").TimelineImage | null>(null);
  const startX = useRef(0);

  const handleMouseDown = (e: React.MouseEvent, side: 'left' | 'right' | 'both') => {
    e.stopPropagation();
    setIsDragging(side);
    setOriginalItem({ ...item });
    startX.current = e.clientX;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX.current;
      onDrag(isDragging, deltaX);
    };

    const handleMouseUp = () => {
      setIsDragging(null);
      setOriginalItem(null);
      onDrop();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onDrag, onDrop]);

  return (
    <div 
      data-draggable
      className={cn(
        "absolute top-1 bottom-1 cursor-move flex items-center px-2 overflow-hidden select-none group transition-colors rounded-sm",
        selected
          ? "bg-[#4e3a7c] ring-2 ring-[#8b5cf6] text-white z-10"
          : "bg-[#4c1d95] border border-[#5b21b6] text-[#cccccc] hover:bg-[#5b21b6]",
        isDragging && "ring-1 ring-white z-20"
      )}
      style={{ 
        left: `${item.projectStartTime * pixelsPerSecond}px`, 
        width: `${Math.max(item.duration * pixelsPerSecond, 20)}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={(e) => handleMouseDown(e, 'both')}
      onContextMenu={onContextMenu}
    >
      {/* Ghost Representation */}
      {isDragging && originalItem && (
        <div 
          className="absolute inset-y-0 opacity-20 bg-white border border-white/50 pointer-events-none z-0 rounded-sm"
          style={{ 
            left: `${(originalItem.projectStartTime - item.projectStartTime) * pixelsPerSecond}px`, 
            width: `${originalItem.duration * pixelsPerSecond}px` 
          }}
        />
      )}

      {/* Dragging Tooltip */}
      {isDragging && (
        <div className="absolute -top-6 left-0 bg-[#8b5cf6] text-white text-[9px] px-1 rounded shadow-lg z-50 whitespace-nowrap font-mono py-0.5">
           {isDragging === 'both' ? formatTime(item.projectStartTime) : formatTime(item.duration)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-medium truncate pointer-events-none">
          {asset.originalFilename}
        </div>
        <div className="text-[8px] opacity-60 pointer-events-none">
          {formatTime(item.duration)} duration
        </div>
      </div>
      
      {/* Resize handles */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 z-20 opacity-0 group-hover:opacity-100 transition-opacity" 
        onMouseDown={(e) => handleMouseDown(e, 'left')}
      />
      <div 
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 z-20 opacity-0 group-hover:opacity-100 transition-opacity" 
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      />
    </div>
  );
}

// ============================================================================
// Timeline Context Menu
// ============================================================================

function TimelineContextMenu({ x, y, onDuplicate, onSplit, onRemove, onClose }: {
  x: number;
  y: number;
  onDuplicate?: () => void;
  onSplit?: () => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  return (
    <div 
      className="fixed z-[100] bg-[#252526] border border-[#454545] rounded shadow-xl py-1 min-w-[140px] text-sm text-[#cccccc]"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      {onDuplicate && (
        <button 
          className="w-full text-left px-3 py-1.5 hover:bg-[#094771] hover:text-white flex items-center"
          onClick={() => { onDuplicate(); onClose(); }}
        >
          <span className="flex-1">Duplicate</span>
          <span className="text-[10px] opacity-50 ml-2">Ctrl+D</span>
        </button>
      )}
      {onSplit && (
        <button 
          className="w-full text-left px-3 py-1.5 hover:bg-[#094771] hover:text-white flex items-center"
          onClick={() => { onSplit(); onClose(); }}
        >
          <span className="flex-1">Split at Playhead</span>
          <span className="text-[10px] opacity-50 ml-2">S</span>
        </button>
      )}
      <div className="h-px bg-[#454545] my-1" />
      {onRemove && (
        <button 
          className="w-full text-left px-3 py-1.5 hover:bg-red-900/50 hover:text-red-200 flex items-center text-red-400"
          onClick={() => { onRemove(); onClose(); }}
        >
          <span className="flex-1">Remove</span>
          <span className="text-[10px] opacity-50 ml-2">Del</span>
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Subtitle Bubble
// ============================================================================

function SubtitleBubble({ subtitle, pixelsPerSecond, onDrag, onDrop, active, selected, onClick }: { 
  subtitle: SubtitleLine, 
  pixelsPerSecond: number, 
  onDrag: (side: 'left' | 'right' | 'both', deltaX: number) => void,
  onDrop: () => void,
  active: boolean,
  selected: boolean,
  onClick: (e: React.MouseEvent) => void
}) {
  const [isDragging, setIsDragging] = useState<'left' | 'right' | 'both' | null>(null);
  const [originalSub, setOriginalSub] = useState<SubtitleLine | null>(null);
  const startX = useRef(0);

  const handleMouseDown = (e: React.MouseEvent, side: 'left' | 'right' | 'both') => {
    e.stopPropagation();
    setIsDragging(side);
    setOriginalSub({ ...subtitle });
    startX.current = e.clientX;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX.current;
      onDrag(isDragging, deltaX);
    };

    const handleMouseUp = () => {
      setIsDragging(null);
      setOriginalSub(null);
      onDrop();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onDrag, onDrop]);

  return (
    <div 
      data-draggable
      className={cn(
        "absolute top-1 bottom-1 cursor-move flex flex-col justify-center px-2 overflow-hidden select-none group transition-colors border-l-2 border-r-2 rounded-sm",
        active 
          ? "bg-[#264f78] border-l-[#007acc] border-r-[#007acc] text-white z-10" 
          : selected
            ? "bg-[#3e3e42] border-l-[#22c55e] border-r-[#22c55e] text-white ring-1 ring-[#22c55e] z-10"
            : "bg-[#2d2d2d] border-l-[#3e3e42] border-r-[#3e3e42] text-[#cccccc] hover:bg-[#3e3e42]",
        isDragging && "ring-1 ring-white z-20"
      )}
      style={{ 
        left: `${subtitle.startTime * pixelsPerSecond}px`, 
        width: `${Math.max((subtitle.endTime - subtitle.startTime) * pixelsPerSecond, 4)}px`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      onMouseDown={(e) => handleMouseDown(e, 'both')}
    >
      {/* Ghost Representation */}
      {isDragging && originalSub && (
        <div 
          className="absolute inset-y-0 opacity-20 bg-white border border-white/50 pointer-events-none z-0 rounded-sm"
          style={{ 
            left: `${(originalSub.startTime - subtitle.startTime) * pixelsPerSecond}px`, 
            width: `${(originalSub.endTime - originalSub.startTime) * pixelsPerSecond}px` 
          }}
        />
      )}

      {/* Dragging Tooltip */}
      {isDragging && (
        <div className="absolute -top-6 left-0 bg-[#22c55e] text-white text-[9px] px-1 rounded shadow-lg z-50 whitespace-nowrap font-mono py-0.5">
           {isDragging === 'both' ? formatTime(subtitle.startTime) : formatTime(subtitle.endTime - subtitle.startTime)}
        </div>
      )}
      <div className="text-[10px] font-medium truncate pointer-events-none">{subtitle.text}</div>
      {subtitle.secondaryText && (
        <div className="text-[9px] opacity-75 truncate pointer-events-none text-[#d7ba7d]">{subtitle.secondaryText}</div>
      )}
      
      {/* Handles */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 z-20 opacity-0 group-hover:opacity-100 transition-opacity" 
        onMouseDown={(e) => handleMouseDown(e, 'left')}
      />
      <div 
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/10 z-20 opacity-0 group-hover:opacity-100 transition-opacity" 
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      />
    </div>
  );
}

// ============================================================================
// Audio Clip Block (Visual Only for now)
// ============================================================================

function AudioClipBlock({ clip, pixelsPerSecond, selected, onContextMenu }: {
  clip: TimelineClip;
  pixelsPerSecond: number;
  selected: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const width = Math.max(clip.clipDuration * pixelsPerSecond, 20);
  
  // Generate a stable pseudo-random waveform path based on clip ID
  const waveformPath = React.useMemo(() => {
    let d = `M 0 24`;
    const points = Math.ceil(width / 3); // One point every 3 pixels
    for (let i = 0; i <= points; i++) {
       const x = i * 3;
       // Pseudo-random height based on index + clip ID hash (simplified)
       // Use a simple hash of the ID string
       const hash = clip.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
       const random = Math.sin(i * 0.5 + hash) * 0.5 + 0.5; 
       
       // Mirror effect (centered around y=24)
       // Height varies between 10px and ~40px
       const height = 10 + (random * 30); 
       const y1 = 24 - (height / 2);
       const y2 = 24 + (height / 2);
       
       // Draw a vertical line for this sample
       d += ` M ${x} ${y1} L ${x} ${y2}`;
    }
    return d;
  }, [width, clip.id]);

  return (
    <div 
      className={cn(
        "absolute top-1 bottom-1 px-0 flex items-center overflow-hidden select-none rounded-sm border",
        selected
          ? "bg-[#1e3a5f] border-[#007acc] text-white z-10" // Darker blue for audio
          : "bg-[#1a2e1a] border-[#2d402d] text-[#cccccc]" // Very dark green background
      )}
      style={{ 
        left: `${clip.projectStartTime * pixelsPerSecond}px`, 
        width: `${width}px`,
      }}
      onContextMenu={onContextMenu}
    >
         {/* Waveform Visualization */}
         <div className="absolute inset-0 opacity-80 pointer-events-none">
            <svg width="100%" height="100%" preserveAspectRatio="none" className="text-[#4a9c5d]">
               <path d={waveformPath} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" />
            </svg>
         </div>
         
         <div className="absolute top-0 left-1 right-1 h-full flex items-start pt-1">
             <span className="text-[9px] font-mono opacity-70 relative z-10 bg-black/40 px-1 rounded truncate pointer-events-none select-none">
               Audio
             </span>
         </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
