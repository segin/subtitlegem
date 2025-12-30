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
  onSelect: (id: string, shiftKey: boolean) => void;
  onSplit: (id: string) => void;
  
  // Multi-video support (optional - V2 mode)
  videoClips?: VideoClip[];
  timelineClips?: TimelineClip[];
  onTimelineClipsUpdate?: (clips: TimelineClip[]) => void;
  selectedClipId?: string | null;
  onClipSelect?: (clipId: string | null) => void;
}

// Legacy props for backwards compatibility
interface LegacyTimelineProps {
  subtitles: SubtitleLine[];
  duration: number;
  onUpdate: (updatedSubtitles: SubtitleLine[]) => void;
  currentTime: number;
  onSeek: (time: number) => void;
  selectedIds: string[];
  onSelect: (id: string, shiftKey: boolean) => void;
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

export function SubtitleTimeline(props: SubtitleTimelineProps) {
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
  
  const isMultiVideoMode = videoClips && timelineClips && timelineClips.length > 0;

  const containerRef = useRef<HTMLDivElement>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(100);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Subtitle drag handler
  const handleSubtitleDrag = useCallback((id: string, side: 'left' | 'right' | 'both', deltaX: number) => {
    const deltaSeconds = deltaX / pixelsPerSecond;
    const newSubtitles = subtitles.map(s => {
      if (s.id !== id) return s;
      
      let newStart = s.startTime;
      let newEnd = s.endTime;

      if (side === 'left' || side === 'both') newStart = Math.max(0, s.startTime + deltaSeconds);
      if (side === 'right' || side === 'both') newEnd = Math.min(duration, s.endTime + deltaSeconds);

      // Prevent negative duration
      if (newEnd - newStart < 0.1) return s;

      return { ...s, startTime: newStart, endTime: newEnd };
    });
    onSubtitlesUpdate(newSubtitles);
  }, [subtitles, pixelsPerSecond, duration, onSubtitlesUpdate]);

  // Video clip drag handler
  const handleClipDrag = useCallback((clipId: string, side: 'left' | 'right' | 'both', deltaX: number) => {
    if (!timelineClips || !onTimelineClipsUpdate) return;
    
    const deltaSeconds = deltaX / pixelsPerSecond;
    const newClips = timelineClips.map(clip => {
      if (clip.id !== clipId) return clip;
      
      let newStart = clip.projectStartTime;
      let newDuration = clip.clipDuration;
      let newInPoint = clip.sourceInPoint;

      if (side === 'both') {
        // Move entire clip
        newStart = Math.max(0, clip.projectStartTime + deltaSeconds);
      } else if (side === 'left') {
        // Trim start (adjusts inPoint and duration)
        const adjustment = deltaSeconds;
        newInPoint = Math.max(0, clip.sourceInPoint + adjustment);
        newDuration = Math.max(0.1, clip.clipDuration - adjustment);
        newStart = clip.projectStartTime + adjustment;
      } else if (side === 'right') {
        // Trim end (adjusts duration only)
        newDuration = Math.max(0.1, clip.clipDuration + deltaSeconds);
      }

      return { 
        ...clip, 
        projectStartTime: Math.max(0, newStart),
        sourceInPoint: newInPoint,
        clipDuration: newDuration,
      };
    });
    onTimelineClipsUpdate(newClips);
  }, [timelineClips, pixelsPerSecond, onTimelineClipsUpdate]);

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

  return (
    <div className="relative w-full h-full flex flex-col bg-[#1e1e1e]">
      {/* Timeline Controls Overlay */}
      <div className="absolute top-2 right-4 z-40 flex items-center space-x-1 bg-[#252526] px-2 py-1 rounded shadow-md border border-[#333333]">
         <button 
           onClick={handleZoomOut}
           className="p-1 hover:bg-[#3e3e42] rounded text-[#cccccc]"
           title="Zoom Out"
         >
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
         </button>
         <span className="text-[10px] text-[#888888] font-mono min-w-[32px] text-center">
            {Math.round((pixelsPerSecond / 100) * 100)}%
         </span>
         <button 
           onClick={handleZoomIn}
           className="p-1 hover:bg-[#3e3e42] rounded text-[#cccccc]"
           title="Zoom In"
         >
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
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
            <div className="ml-16 relative h-full px-0">
              {subtitles.map((sub) => (
                <SubtitleBubble 
                  key={sub.id} 
                  subtitle={sub} 
                  pixelsPerSecond={pixelsPerSecond}
                  onDrag={(side, deltaX) => handleSubtitleDrag(sub.id, side, deltaX)}
                  active={currentTime >= sub.startTime && currentTime <= sub.endTime}
                  selected={selectedIds.includes(sub.id)}
                  onClick={(e) => onSelect(sub.id, e.shiftKey)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

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

function VideoClipBlock({ clip, videoClip, pixelsPerSecond, selected, onDrag, onClick }: {
  clip: TimelineClip;
  videoClip: VideoClip;
  pixelsPerSecond: number;
  selected: boolean;
  onDrag: (side: 'left' | 'right' | 'both', deltaX: number) => void;
  onClick: () => void;
}) {
  const [isDragging, setIsDragging] = useState<'left' | 'right' | 'both' | null>(null);
  const startX = useRef(0);

  const handleMouseDown = (e: React.MouseEvent, side: 'left' | 'right' | 'both') => {
    e.stopPropagation();
    setIsDragging(side);
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
    >
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
  const startX = useRef(0);

  const handleMouseDown = (e: React.MouseEvent, side: 'left' | 'right' | 'both') => {
    e.stopPropagation();
    setIsDragging(side);
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
