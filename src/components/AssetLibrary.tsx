import React, { useState } from 'react';
import { Film, Image as ImageIcon, Trash2, GripVertical } from 'lucide-react';
import { VideoClip, ImageAsset } from '@/types/subtitle';
import { formatBytes } from '@/lib/format-utils';

interface AssetLibraryProps {
  videoClips: VideoClip[];
  imageAssets?: ImageAsset[];
  onDragStart: (e: React.DragEvent, id: string, type: 'video' | 'image') => void;
  onDeleteAsset?: (id: string, type: 'video' | 'image') => void;
  className?: string;
}

export function AssetLibrary({
  videoClips,
  imageAssets = [],
  onDragStart,
  onDeleteAsset,
  className = ''
}: AssetLibraryProps) {
  const [activeTab, setActiveTab] = useState<'videos' | 'images'>('videos');

  const handleDragStart = (e: React.DragEvent, id: string, type: 'video' | 'image') => {
    // Set standard drag data
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', id);
    
    // Set custom data for timeline to recognize asset type
    const dragPayload = JSON.stringify({ id, type });
    e.dataTransfer.setData('application/subtitlegem-asset', dragPayload);
    
    if (onDragStart) {
      onDragStart(e, id, type);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex flex-col bg-[#1e1e1e] border-l border-[#333333] ${className}`}>
      {/* Header */}
      <div className="h-9 flex items-center px-2 bg-[#252526] border-b border-[#333333]">
        <span className="text-xs font-semibold text-[#cccccc] uppercase tracking-wider">Asset Library</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#333333]">
        <button
          onClick={() => setActiveTab('videos')}
          className={`flex-1 py-2 text-xs font-medium text-center transition-colors ${
            activeTab === 'videos' 
              ? 'text-white border-b-2 border-[#007acc] bg-[#1e1e1e]' 
              : 'text-[#888888] bg-[#2d2d2d] hover:bg-[#252526]'
          }`}
        >
          Videos ({videoClips.length})
        </button>
        <button
          onClick={() => setActiveTab('images')}
          className={`flex-1 py-2 text-xs font-medium text-center transition-colors ${
            activeTab === 'images' 
              ? 'text-white border-b-2 border-[#007acc] bg-[#1e1e1e]' 
              : 'text-[#888888] bg-[#2d2d2d] hover:bg-[#252526]'
          }`}
        >
          Images ({imageAssets.length})
        </button>
      </div>

      {/* Content List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {activeTab === 'videos' ? (
          <div className="space-y-2">
            {videoClips.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#555555]">
                No videos imported
              </div>
            ) : (
              videoClips.map((clip) => (
                <div
                  key={clip.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, clip.id, 'video')}
                  className="group relative bg-[#252526] hover:bg-[#2a2d2e] border border-[#333333] hover:border-[#454545] rounded p-2 cursor-grab active:cursor-grabbing transition-all select-none"
                >
                  <div className="flex items-start gap-2">
                    <div className="w-10 h-10 bg-[#111111] rounded flex items-center justify-center shrink-0">
                      <Film className="w-5 h-5 text-[#888888]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[#e1e1e1] font-medium truncate" title={clip.originalFilename}>
                        {clip.originalFilename}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-[#888888]">
                        <span>{formatDuration(clip.duration)}</span>
                        <span>•</span>
                        <span>{clip.width}x{clip.height}</span>
                        {clip.fileSize && (
                          <>
                            <span>•</span>
                            <span>{formatBytes(clip.fileSize)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Hover Actions */}
                  {onDeleteAsset && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remove "${clip.originalFilename}" from library?`)) {
                           onDeleteAsset(clip.id, 'video');
                        }
                      }}
                      className="absolute top-1 right-1 p-1 text-[#555555] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {imageAssets.length === 0 ? (
              <div className="col-span-2 text-center py-8 text-xs text-[#555555]">
                No images imported
              </div>
            ) : (
              imageAssets.map((asset) => (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, asset.id, 'image')}
                  className="group relative bg-[#252526] hover:bg-[#2a2d2e] border border-[#333333] hover:border-[#454545] rounded cursor-grab active:cursor-grabbing transition-all select-none aspect-square flex flex-col items-center justify-center overflow-hidden"
                >
                  <div className="p-2 w-full h-full flex flex-col items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-[#888888] mb-1" />
                    <div className="text-[10px] text-[#e1e1e1] w-full truncate text-center px-1">
                      {asset.originalFilename}
                    </div>
                    <div className="text-[9px] text-[#666666]">
                      {asset.width}x{asset.height}
                    </div>
                  </div>

                  {/* Hover Actions */}
                  {onDeleteAsset && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                         if (confirm(`Remove "${asset.originalFilename}" from library?`)) {
                           onDeleteAsset(asset.id, 'image');
                        }
                      }}
                      className="absolute top-1 right-1 p-1 bg-black/50 rounded text-white/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
