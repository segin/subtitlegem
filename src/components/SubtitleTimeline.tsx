"use client";

import React, { useState, useRef, useEffect } from "react";
import { SubtitleLine } from "@/types/subtitle";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TimelineProps {
  subtitles: SubtitleLine[];
  duration: number;
  onUpdate: (updatedSubtitles: SubtitleLine[]) => void;
  currentTime: number;
  onSeek: (time: number) => void;
  // Selection props (shared with SubtitleList)
  selectedIds: string[];
  onSelect: (id: string, shiftKey: boolean) => void;
  onSplit: (id: string) => void;
}

export function SubtitleTimeline({ subtitles, duration, onUpdate, currentTime, onSeek, selectedIds, onSelect, onSplit }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(100);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const handleDrag = (id: string, side: 'left' | 'right' | 'both', deltaX: number) => {
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
    onUpdate(newSubtitles);
  };

  // Seek to position based on mouse X
  const seekFromEvent = (e: React.MouseEvent | MouseEvent, rect: DOMRect) => {
    const x = (e as MouseEvent).clientX - rect.left;
    const time = Math.max(0, Math.min(duration, x / pixelsPerSecond));
    onSeek(time);
  };

  // Handle Ctrl+scroll for zoom, regular scroll for horizontal panning
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      // Zoom
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setPixelsPerSecond(prev => Math.max(20, Math.min(400, prev * zoomFactor)));
    } else {
      // Convert vertical scroll to horizontal scroll
      // Also supports native horizontal scroll wheel (deltaX)
      const scrollAmount = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      if (scrollAmount !== 0 && containerRef.current) {
        e.preventDefault();
        containerRef.current.scrollLeft += scrollAmount;
      }
    }
  };

  // Handle scrubbing globally
  React.useEffect(() => {
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
  }, [isScrubbing, pixelsPerSecond, duration, onSeek]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-[#1e1e1e] overflow-x-auto overflow-y-hidden relative custom-scrollbar select-none"
      onWheel={handleWheel}
    >
      <div 
        data-timeline-bg
        className="relative h-full min-w-full cursor-pointer" 
        style={{ width: `${Math.max(duration * pixelsPerSecond, 1000)}px` }}
        onMouseDown={(e) => {
          // Only start scrubbing if not clicking on a bubble
          if ((e.target as HTMLElement).closest('[data-bubble]')) return;
          const rect = e.currentTarget.getBoundingClientRect();
          seekFromEvent(e, rect);
          setIsScrubbing(true);
        }}
      >
        {/* Time Ruler */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-[#252526] border-b border-[#333333] flex items-end select-none">
          {Array.from({ length: Math.ceil(duration) }).map((_, i) => (
            <div 
              key={i} 
              className="absolute bottom-0 h-2 border-l border-[#555555] text-[9px] text-[#888888] pl-1 font-mono"
              style={{ left: `${i * pixelsPerSecond}px` }}
            >
              {i % 5 === 0 && <span>{new Date(i * 1000).toISOString().substr(14, 5)}</span>}
            </div>
          ))}
          {/* Sub-ticks */}
           {Array.from({ length: Math.ceil(duration * 2) }).map((_, i) => (
             <div 
               key={`sub-${i}`}
               className="absolute bottom-0 h-1 border-l border-[#333333]"
               style={{ left: `${i * (pixelsPerSecond / 2)}px` }}
             />
           ))}
        </div>

        {/* Tracks Area */}
        <div className="mt-8 relative h-32 px-0">
             {/* Playhead Line */}
            <div 
              className="absolute top-[-32px] bottom-0 w-px bg-red-500 z-30 pointer-events-none"
              style={{ left: `${currentTime * pixelsPerSecond}px` }}
            >
              <div className="absolute -top-0 -left-1.5 w-3 h-3 bg-red-500 clip-path-polygon-[50%_100%,_0%_0%,_100%_0%]" />
            </div>

            {/* Subtitle Bubbles */}
            {subtitles.map((sub) => (
              <SubtitleBubble 
                key={sub.id} 
                subtitle={sub} 
                pixelsPerSecond={pixelsPerSecond}
                onDrag={(side, deltaX) => handleDrag(sub.id, side, deltaX)}
                active={currentTime >= sub.startTime && currentTime <= sub.endTime}
                selected={selectedIds.includes(sub.id)}
                onClick={(e) => onSelect(sub.id, e.shiftKey)}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

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
      data-bubble
      className={cn(
        "absolute top-2 h-10 cursor-move flex flex-col justify-center px-2 overflow-hidden select-none group transition-colors border-l-2 border-r-2",
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
        borderRadius: '1px'
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
