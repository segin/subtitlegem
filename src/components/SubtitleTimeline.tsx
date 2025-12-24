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
}

export function SubtitleTimeline({ subtitles, duration, onUpdate, currentTime, onSeek }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(100);

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

  return (
    <div className="w-full h-full bg-slate-900 overflow-x-auto relative custom-scrollbar select-none">
      <div 
        className="relative h-full min-w-full" 
        style={{ width: `${Math.max(duration * pixelsPerSecond, 1000)}px` }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          onSeek(x / pixelsPerSecond);
        }}
      >
        {/* Time Ruler */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-slate-950 border-b border-slate-800 flex items-end">
          {Array.from({ length: Math.ceil(duration) }).map((_, i) => (
            <div 
              key={i} 
              className="absolute bottom-0 h-3 border-l border-slate-700 text-[10px] text-slate-500 pl-1 font-mono"
              style={{ left: `${i * pixelsPerSecond}px` }}
            >
              {i % 5 === 0 && <span>{new Date(i * 1000).toISOString().substr(14, 5)}</span>}
            </div>
          ))}
        </div>

        {/* Tracks Area */}
        <div className="mt-8 relative h-32">
             {/* Playhead Line */}
            <div 
              className="absolute top-[-32px] bottom-0 w-px bg-red-500 z-30 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.5)]"
              style={{ left: `${currentTime * pixelsPerSecond}px` }}
            >
              <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rotate-45 transform" />
            </div>

            {/* Subtitle Bubbles */}
            {subtitles.map((sub) => (
              <SubtitleBubble 
                key={sub.id} 
                subtitle={sub} 
                pixelsPerSecond={pixelsPerSecond}
                onDrag={(side, deltaX) => handleDrag(sub.id, side, deltaX)}
                active={currentTime >= sub.startTime && currentTime <= sub.endTime}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

function SubtitleBubble({ subtitle, pixelsPerSecond, onDrag, active }: { 
  subtitle: SubtitleLine, 
  pixelsPerSecond: number, 
  onDrag: (side: 'left' | 'right' | 'both', deltaX: number) => void,
  active: boolean
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
      className={cn(
        "absolute top-2 h-12 rounded-md cursor-move flex flex-col justify-center px-2 overflow-hidden select-none group transition-colors border",
        active 
          ? "bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/30 z-10" 
          : "bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600",
        isDragging && "ring-2 ring-white z-20"
      )}
      style={{ 
        left: `${subtitle.startTime * pixelsPerSecond}px`, 
        width: `${Math.max((subtitle.endTime - subtitle.startTime) * pixelsPerSecond, 10)}px` 
      }}
      onMouseDown={(e) => handleMouseDown(e, 'both')}
    >
      <div className="text-[10px] font-bold truncate pointer-events-none">{subtitle.text}</div>
      {subtitle.secondaryText && (
        <div className="text-[9px] opacity-75 truncate pointer-events-none">{subtitle.secondaryText}</div>
      )}
      
      {/* Handles */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" 
        onMouseDown={(e) => handleMouseDown(e, 'left')}
      >
        <div className="w-0.5 h-4 bg-white/50 rounded-full" />
      </div>
      <div 
        className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" 
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      >
        <div className="w-0.5 h-4 bg-white/50 rounded-full" />
      </div>
    </div>
  );
}