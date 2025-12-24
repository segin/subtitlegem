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
    <div className="w-full bg-gray-900 rounded-lg p-4 overflow-x-auto relative min-h-[200px] border border-gray-700">
      <div 
        className="relative h-full" 
        style={{ width: `${duration * pixelsPerSecond}px` }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          onSeek(x / pixelsPerSecond);
        }}
      >
        {/* Playhead */}
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
          style={{ left: `${currentTime * pixelsPerSecond}px` }}
        />

        {/* Subtitle Bubbles */}
        {subtitles.map((sub) => (
          <SubtitleBubble 
            key={sub.id} 
            subtitle={sub} 
            pixelsPerSecond={pixelsPerSecond}
            onDrag={(side, deltaX) => handleDrag(sub.id, side, deltaX)}
          />
        ))}
        
        {/* Time markers */}
        <div className="absolute bottom-0 left-0 right-0 flex text-[10px] text-gray-500 border-t border-gray-800">
          {Array.from({ length: Math.ceil(duration) }).map((_, i) => (
            <div 
              key={i} 
              className="absolute h-2 border-l border-gray-700"
              style={{ left: `${i * pixelsPerSecond}px` }}
            >
              <span className="ml-1">{i}s</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SubtitleBubble({ subtitle, pixelsPerSecond, onDrag }: { 
  subtitle: SubtitleLine, 
  pixelsPerSecond: number, 
  onDrag: (side: 'left' | 'right' | 'both', deltaX: number) => void 
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
        "absolute top-4 h-16 bg-blue-600/30 border border-blue-500 rounded-md cursor-move flex flex-col justify-center px-2 overflow-hidden select-none group transition-colors",
        isDragging && "bg-blue-600/50 border-blue-400"
      )}
      style={{ 
        left: `${subtitle.startTime * pixelsPerSecond}px`, 
        width: `${(subtitle.endTime - subtitle.startTime) * pixelsPerSecond}px` 
      }}
      onMouseDown={(e) => handleMouseDown(e, 'both')}
    >
      <div className="text-[10px] font-bold text-white truncate">{subtitle.text}</div>
      {subtitle.secondaryText && (
        <div className="text-[9px] text-blue-200 truncate">{subtitle.secondaryText}</div>
      )}
      
      {/* Handles */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-blue-400 opacity-0 group-hover:opacity-100" 
        onMouseDown={(e) => handleMouseDown(e, 'left')}
      />
      <div 
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-blue-400 opacity-0 group-hover:opacity-100" 
        onMouseDown={(e) => handleMouseDown(e, 'right')}
      />
    </div>
  );
}
