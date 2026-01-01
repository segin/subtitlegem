"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { SubtitleLine, VideoClip, TimelineClip } from "@/types/subtitle";
import { AlertCircle, Magnet } from "lucide-react";
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
  
  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetId: string;
    targetType: 'video' | 'image';
  } | null>(null);
  const [snappingEnabled, setSnappingEnabled] = useState(true);

  // Snapping helper: snaps time to playhead, other boundaries, or 1s intervals
  const getSnappedTime = useCallback((time: number, excludeId?: string) => {
    if (!snappingEnabled) return time;
    
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

  // Subtitle drag handler
  const handleSubtitleDrag = useCallback((id: string, side: 'left' | 'right' | 'both', deltaX: number) => {
    const deltaSeconds = deltaX / pixelsPerSecond;
    const sub = subtitles.find(s => s.id === id);
    if (!sub) return;
    
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

    const newSubtitles = subtitles.map(s => s.id === id ? { ...s, startTime: newStart, endTime: newEnd } : s);
    onSubtitlesUpdate(newSubtitles);
  }, [subtitles, pixelsPerSecond, duration, onSubtitlesUpdate, getSnappedTime]);

  // Video clip drag handler
  const handleClipDrag = useCallback((clipId: string, side: 'left' | 'right' | 'both', deltaX: number) => {
    if (!timelineClips || !onTimelineClipsUpdate) return;
    
    const deltaSeconds = deltaX / pixelsPerSecond;
    const currentClip = timelineClips.find(c => c.id === clipId);
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
      newDuration = Math.max(0.1, currentClip.clipDuration - (snappedStart - currentClip.projectStartTime));
      newStart = snappedStart;
    } else if (side === 'right') {
      const newEndTime = getSnappedTime(currentClip.projectStartTime + currentClip.clipDuration + deltaSeconds, clipId);
      newDuration = Math.max(0.1, newEndTime - currentClip.projectStartTime);
    }

    const newClips = timelineClips.map(clip => 
      clip.id === clipId ? { ...clip, projectStartTime: Math.max(0, newStart), sourceInPoint: newInPoint, clipDuration: newDuration } : clip
    );
    onTimelineClipsUpdate(newClips);
  }, [timelineClips, pixelsPerSecond, onTimelineClipsUpdate, getSnappedTime]);

  // Image clip drag handler
  const handleImageDrag = useCallback((id: string, side: 'left' | 'right' | 'both', deltaX: number) => {
    if (!onTimelineImagesUpdate || !timelineImages) return;
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

    const newImages = timelineImages.map(i => 
      i.id === id ? { ...i, projectStartTime: Math.max(0, newStart), duration: newDur } : i
    );
    onTimelineImagesUpdate(newImages);
  }, [timelineImages, pixelsPerSecond, onTimelineImagesUpdate, getSnappedTime]);

  // Seek to position based on mouse X
  const seekFromEvent = useCallback((e: React.MouseEvent | MouseEvent, rect: DOMRect) => {
    const x = (e as MouseEvent).clientX - rect.left;
    const time = Math.max(0, Math.min(duration, x / pixelsPerSecond));
    onSeek(time);
  }, [duration, pixelsPerSecond, onSeek]);

  // Handle Ctrl+scroll for zoom, regular scroll for horizontal panning
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey) {
      // Zoom
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setPixelsPerSecond(prev => Math.max(20, Math.min(400, prev * zoomFactor)));
    } else {
      // Convert vertical scroll to horizontal scroll
      const scrollAmount = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      if (scrollAmount !== 0 && containerRef.current) {
        e.preventDefault();
        containerRef.current.scrollLeft += scrollAmount;
      }
    }
  }, []);

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

  // Track heights
  const RULER_HEIGHT = 24;
  const VIDEO_TRACK_HEIGHT = isMultiVideoMode ? 48 : 0;
  const SUBTITLE_TRACK_HEIGHT = 48;
  const TOTAL_TRACKS_HEIGHT = VIDEO_TRACK_HEIGHT + SUBTITLE_TRACK_HEIGHT + 16;
  
  // Zoom handlers
  const handleZoomIn = () => setPixelsPerSecond(prev => Math.min(400, prev * 1.2));
  const handleZoomOut = () => setPixelsPerSecond(prev => Math.max(20, prev * 0.8));

  React.useImperativeHandle(ref, () => ({
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
  }));
  
  // Fit to View: Calculate zoom level to fit entire duration in visible area
  const handleFitToView = useCallback(() => {
    if (!containerRef.current || duration <= 0) return;
    const containerWidth = containerRef.current.clientWidth - 64; // Subtract track label width
    const newPPS = Math.max(20, Math.min(400, containerWidth / duration));
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
    const playheadX = currentTime * pixelsPerSecond;
    const scrollLeft = container.scrollLeft;
    const visibleWidth = container.clientWidth;
    // Scroll if playhead is outside visible area (with margin)
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
        className="flex-1 w-full bg-[#1e1e1e] overflow-x-auto overflow-y-hidden relative custom-scrollbar select-none"
        onWheel={handleWheel}
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
          className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none"
          style={{ left: `${currentTime * pixelsPerSecond}px` }}
        >
          <div className="absolute top-0 -left-1.5 w-3 h-3 bg-red-500" style={{ clipPath: 'polygon(50% 100%, 0% 0%, 100% 0%)' }} />
        </div>

        {/* Tracks Container */}
        <div className="relative" style={{ marginTop: RULER_HEIGHT }}>
          
          {/* Video Track (only in multi-video mode) */}
          {isMultiVideoMode && videoClips && (
            <div className="relative" style={{ height: VIDEO_TRACK_HEIGHT }}>
              <div className="absolute left-0 top-0 bottom-0 w-16 bg-[#252526] border-r border-[#333333] flex items-center justify-center z-10">
                <span className="text-[10px] text-[#888888] font-medium">VIDEO</span>
              </div>
              <div className="ml-16 relative h-full">
                {timelineClips?.map(clip => {
                  const videoClip = videoClips.find(v => v.id === clip.videoClipId);
                  if (!videoClip) return null;
                  
                  return (
                    <VideoClipBlock
                      key={clip.id}
                      clip={clip}
                      videoClip={videoClip}
                      pixelsPerSecond={pixelsPerSecond}
                      selected={selectedClipId === clip.id}
                      onDrag={(side, deltaX) => handleClipDrag(clip.id, side, deltaX)}
                      onClick={() => onClipSelect?.(clip.id)}
                      onContextMenu={(e) => handleContextMenu(e, clip.id, 'video')}
                    />
                  );
                })}

                {/* Timeline Images */}
                {isMultiVideoMode && timelineImages?.map(img => {
                  const asset = imageAssets?.find(a => a.id === img.imageAssetId);
                  if (!asset) return null;
                  
                  return (
                    <ImageClipBlock
                      key={img.id}
                      item={img}
                      asset={asset}
                      pixelsPerSecond={pixelsPerSecond}
                      selected={selectedImageId === img.id}
                      onDrag={(side, deltaX) => handleImageDrag(img.id, side, deltaX)}
                      onClick={() => onImageSelect?.(img.id)}
                      onContextMenu={(e) => handleContextMenu(e, img.id, 'image')}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Subtitle Track */}
          <div className="relative" style={{ height: SUBTITLE_TRACK_HEIGHT, marginTop: isMultiVideoMode ? 8 : 0 }}>
            <div className="absolute left-0 top-0 bottom-0 w-16 bg-[#252526] border-r border-[#333333] flex items-center justify-center z-10">
              <span className="text-[10px] text-[#888888] font-medium">SUBS</span>
            </div>
            <div 
              className="ml-16 relative h-full px-0"
              onClick={() => onSelect("", false, false)}
            >
              {subtitles.map((sub) => (
                <SubtitleBubble 
                  key={sub.id} 
                  subtitle={sub} 
                  pixelsPerSecond={pixelsPerSecond}
                  onDrag={(side, deltaX) => handleSubtitleDrag(sub.id, side, deltaX)}
                  active={currentTime >= sub.startTime && currentTime <= sub.endTime}
                  selected={selectedIds.includes(sub.id)}
                  onClick={(e) => onSelect(sub.id, e.shiftKey, e.ctrlKey || e.metaKey)}
                />
              ))}
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
  return (
    <div className="absolute top-0 left-0 right-0 h-6 bg-[#252526] border-b border-[#333333] flex items-end select-none">
      {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
        <div 
          key={i} 
          className="absolute bottom-0 h-2 border-l border-[#555555] text-[9px] text-[#888888] pl-1 font-mono"
          style={{ left: `${i * pixelsPerSecond}px` }}
        >
          {i % 5 === 0 && <span>{new Date(i * 1000).toISOString().substr(14, 5)}</span>}
        </div>
      ))}
      {/* Sub-ticks */}
      {Array.from({ length: Math.ceil(duration * 2) + 1 }).map((_, i) => (
        <div 
          key={`sub-${i}`}
          className="absolute bottom-0 h-1 border-l border-[#333333]"
          style={{ left: `${i * (pixelsPerSecond / 2)}px` }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Video Clip Block
// ============================================================================

function VideoClipBlock({ clip, videoClip, pixelsPerSecond, selected, onDrag, onClick, onContextMenu }: {
  clip: TimelineClip;
  videoClip: VideoClip;
  pixelsPerSecond: number;
  selected: boolean;
  onDrag: (side: 'left' | 'right' | 'both', deltaX: number) => void;
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
      startX.current = e.clientX;
    };

    const handleMouseUp = () => {
      setIsDragging(null);
      setOriginalClip(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onDrag]);

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

function ImageClipBlock({ item, asset, pixelsPerSecond, selected, onDrag, onClick, onContextMenu }: {
  item: import("@/types/subtitle").TimelineImage;
  asset: import("@/types/subtitle").ImageAsset;
  pixelsPerSecond: number;
  selected: boolean;
  onDrag: (side: 'left' | 'right' | 'both', deltaX: number) => void;
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
      startX.current = e.clientX;
    };

    const handleMouseUp = () => {
      setIsDragging(null);
      setOriginalItem(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onDrag]);

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

function SubtitleBubble({ subtitle, pixelsPerSecond, onDrag, active, selected, onClick }: { 
  subtitle: SubtitleLine, 
  pixelsPerSecond: number, 
  onDrag: (side: 'left' | 'right' | 'both', deltaX: number) => void,
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
      startX.current = e.clientX;
    };

    const handleMouseUp = () => {
      setIsDragging(null);
      setOriginalSub(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onDrag]);

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
// Helpers
// ============================================================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
