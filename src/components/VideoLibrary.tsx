"use client";

import React, { useState } from "react";
import { VideoClip, TimelineClip, ImageAsset, TimelineImage } from "@/types/subtitle";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Film, Image as ImageIcon } from "lucide-react";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// Types
// ============================================================================

interface VideoLibraryProps {
  clips: VideoClip[];
  timelineClips: TimelineClip[];
  onAddToTimeline: (clipId: string) => void;
  onRemoveClip: (clipId: string) => void;
  onClipSelect: (clipId: string | null) => void;
  selectedClipId: string | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  
  // Image support
  imageAssets?: ImageAsset[];
  timelineImages?: TimelineImage[];
  onAddImageToTimeline?: (imageId: string, duration?: number) => void;
  onRemoveImage?: (imageId: string) => void;
  onRelinkClip?: (clipId: string, file: File) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function VideoLibrary({
  clips,
  timelineClips,
  onAddToTimeline,
  onRemoveClip,
  onClipSelect,
  selectedClipId,
  isCollapsed = false,
  onToggleCollapse,
  imageAssets = [],
  timelineImages = [],
  onAddImageToTimeline,
  onRemoveImage,
  onRelinkClip,
}: VideoLibraryProps) {
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'videos' | 'images'>('videos');

  // Check if a clip is already on the timeline
  const isOnTimeline = (clipId: string) => 
    timelineClips.some(tc => tc.videoClipId === clipId);

  // Count how many times a clip appears on timeline
  const getTimelineCount = (clipId: string) => 
    timelineClips.filter(tc => tc.videoClipId === clipId).length;

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, clipId: string) => {
    setDraggedClipId(clipId);
    e.dataTransfer.setData("application/x-video-clip-id", clipId);
    e.dataTransfer.effectAllowed = "copy";
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedClipId(null);
  };

  if (isCollapsed) {
    return (
      <div className="w-10 h-full bg-[#252526] border-r border-[#333333] flex flex-col items-center py-2">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-[#888888] hover:text-white hover:bg-[#3e3e42] rounded transition-colors"
          title="Expand Video Library"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="mt-2 text-[10px] text-[#888888] writing-mode-vertical transform rotate-180" style={{ writingMode: 'vertical-rl' }}>
          ASSETS ({clips.length + imageAssets.length})
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 h-full bg-[#252526] border-r border-[#333333] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#333333]">
        <h3 className="text-sm font-medium text-white">Assets</h3>
        <div className="flex items-center gap-1">
          <span className="text-xs text-[#888888]">{clips.length + imageAssets.length}</span>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 text-[#888888] hover:text-white hover:bg-[#3e3e42] rounded transition-colors"
              title="Collapse"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#333333]">
        <button
          onClick={() => setActiveTab('videos')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
            activeTab === 'videos' 
              ? "text-white border-b-2 border-[#007acc] bg-[#2d2d2d]" 
              : "text-[#888888] hover:text-white hover:bg-[#3e3e42]"
          )}
        >
          <Film className="w-3.5 h-3.5" />
          Videos ({clips.length})
        </button>
        <button
          onClick={() => setActiveTab('images')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
            activeTab === 'images' 
              ? "text-white border-b-2 border-[#007acc] bg-[#2d2d2d]" 
              : "text-[#888888] hover:text-white hover:bg-[#3e3e42]"
          )}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Images ({imageAssets.length})
        </button>
      </div>

      {/* Content based on active tab */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {activeTab === 'videos' ? (
          clips.length === 0 ? (
            <div className="text-center py-8 text-[#888888] text-sm">
              <p>No video clips</p>
              <p className="text-xs mt-1">Upload videos to add them here</p>
            </div>
          ) : (
            clips.map(clip => (
              <ClipCard
                key={clip.id}
                clip={clip}
                isSelected={selectedClipId === clip.id}
                isOnTimeline={isOnTimeline(clip.id)}
                timelineCount={getTimelineCount(clip.id)}
                isDragging={draggedClipId === clip.id}
                onSelect={() => onClipSelect(clip.id === selectedClipId ? null : clip.id)}
                onAddToTimeline={() => onAddToTimeline(clip.id)}
                onRemove={() => onRemoveClip(clip.id)}
                onRelink={(file) => onRelinkClip?.(clip.id, file)}
                onDragStart={(e) => handleDragStart(e, clip.id)}
                onDragEnd={handleDragEnd}
              />
            ))
          )
        ) : (
          imageAssets.length === 0 ? (
            <div className="text-center py-8 text-[#888888] text-sm">
              <p>No images</p>
              <p className="text-xs mt-1">Drag & drop images here</p>
            </div>
          ) : (
            imageAssets.map(asset => (
              <ImageCard
                key={asset.id}
                asset={asset}
                isOnTimeline={timelineImages.some(ti => ti.imageAssetId === asset.id)}
                onAddToTimeline={() => onAddImageToTimeline?.(asset.id)}
                onRemove={() => onRemoveImage?.(asset.id)}
              />
            ))
          )
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-[#333333] text-[10px] text-[#666666]">
        Drag assets to timeline or double-click to add
      </div>
    </div>
  );
}

// ============================================================================
// Clip Card
// ============================================================================

interface ClipCardProps {
  clip: VideoClip;
  isSelected: boolean;
  isOnTimeline: boolean;
  timelineCount: number;
  isDragging: boolean;
  onSelect: () => void;
  onAddToTimeline: () => void;
  onRemove: () => void;
  onRelink?: (file: File) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function ClipCard({
  clip,
  isSelected,
  isOnTimeline,
  timelineCount,
  isDragging,
  onSelect,
  onAddToTimeline,
  onRemove,
  onRelink,
  onDragStart,
  onDragEnd,
}: ClipCardProps) {
  const relinkInputRef = React.useRef<HTMLInputElement>(null);

  const handleRelinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    relinkInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onRelink) {
      onRelink(file);
    }
    // Reset input
    if (e.target) e.target.value = '';
  };

  return (
    <div
      draggable
      className={cn(
        "relative rounded-md overflow-hidden cursor-pointer transition-all group",
        isSelected
          ? "ring-2 ring-[#007acc] bg-[#264f78]"
          : "bg-[#2d2d2d] hover:bg-[#3e3e42]",
        isDragging && "opacity-50"
      )}
      onClick={onSelect}
      onDoubleClick={onAddToTimeline}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Thumbnail placeholder */}
      <div className="aspect-video bg-[#1e1e1e] flex items-center justify-center">
        <svg className="w-8 h-8 text-[#555555]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>

      {/* Info */}
      <div className="p-2">
        <div className="text-xs font-medium text-white truncate" title={clip.originalFilename}>
          {clip.originalFilename}
        </div>
        <div className="flex items-center justify-between mt-1">
          {clip.missing ? (
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3 text-[#ff4444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs font-medium text-[#ff4444]">Missing File</span>
            </div>
          ) : (
             <>
               <span className="text-[10px] text-[#888888]">
                 {formatDuration(clip.duration)}
               </span>
               <span className="text-[10px] text-[#888888]">
                 {clip.width}×{clip.height}
               </span>
             </>
          )}
        </div>
      </div>

       {/* Relink Input */}
       <input
         type="file"
         ref={relinkInputRef}
         className="hidden"
         onChange={handleFileChange}
         accept="video/*"
       />

      {/* Timeline indicator */}
      {isOnTimeline && (
        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#22c55e] text-white">
          {timelineCount > 1 ? `×${timelineCount}` : '✓'}
        </div>
      )}

      {/* Actions overlay */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToTimeline();
          }}
          className="p-2 rounded-full bg-[#007acc] text-white hover:bg-[#005a9e] transition-colors"
          title="Add to timeline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        {clip.missing && (
          <button
            onClick={handleRelinkClick}
            className="p-2 rounded-full bg-[#ff4444] text-white hover:bg-[#cc3333] transition-colors"
            title="Relink missing file"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-2 rounded-full bg-[#dc2626] text-white hover:bg-[#b91c1c] transition-colors"
          title="Remove from project"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Image Card
// ============================================================================

interface ImageCardProps {
  asset: ImageAsset;
  isOnTimeline: boolean;
  onAddToTimeline: () => void;
  onRemove: () => void;
}

function ImageCard({
  asset,
  isOnTimeline,
  onAddToTimeline,
  onRemove,
}: ImageCardProps) {
  return (
    <div
      draggable
      className={cn(
        "relative rounded-md overflow-hidden cursor-pointer transition-all group",
        "bg-[#2d2d2d] hover:bg-[#3e3e42]"
      )}
      onDoubleClick={onAddToTimeline}
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-image-asset-id", asset.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-[#1e1e1e] flex items-center justify-center overflow-hidden">
        <img 
          src={`/api/storage?path=${encodeURIComponent(asset.filePath)}`} 
          alt={asset.originalFilename}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      {/* Info */}
      <div className="p-2">
        <div className="text-xs font-medium text-white truncate" title={asset.originalFilename}>
          {asset.originalFilename}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-[#888888]">
            {asset.width}×{asset.height}
          </span>
        </div>
      </div>

      {/* Timeline indicator */}
      {isOnTimeline && (
        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#22c55e] text-white">
          ✓
        </div>
      )}

      {/* Actions overlay */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToTimeline();
          }}
          className="p-2 rounded-full bg-[#007acc] text-white hover:bg-[#005a9e] transition-colors"
          title="Add to timeline"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-2 rounded-full bg-[#dc2626] text-white hover:bg-[#b91c1c] transition-colors"
          title="Remove from project"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
