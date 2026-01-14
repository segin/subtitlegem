
import React from 'react';
import { HardDrive, Film, FileText, Clapperboard, CheckCircle2, Trash2, GripVertical, Pencil } from 'lucide-react';
import { DraftItem } from '@/hooks/useHomeState';
import { formatBytes } from '@/lib/format-utils';

interface ProjectCardProps {
  draft: DraftItem;
  isSelected: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onRename?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  forceExpanded?: boolean;
  animationDelay?: number;
}

export function ProjectCard({ draft, isSelected, onClick, onDelete, onRename, isDragging, dragHandleProps, forceExpanded, animationDelay = 0 }: ProjectCardProps) {
  // Format creation date
  const dateStr = new Date(draft.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  // Calculate total size for storage metric
  const totalSize = (draft.metrics?.sourceSize || 0) + (draft.metrics?.renderedSize || 0);

  return (
    <div
      onClick={onClick}
      style={{ animationDelay: `${animationDelay}ms` }}
      className={`
        group relative w-full mb-2 rounded-lg border cursor-pointer overflow-hidden
        animate-in fade-in slide-in-from-left-2 duration-300 fill-mode-backwards
        transition-all duration-200 ease-out
        hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20
        ${isSelected 
          ? 'bg-[#37373d] border-l-4 border-l-blue-500 border-y-transparent border-r-transparent shadow-md shadow-blue-500/10' 
          : 'bg-[#252526] border-transparent hover:bg-[#2a2d2e] hover:border-[#3e3e42]'}
        ${isDragging ? 'opacity-60 scale-105 shadow-xl ring-2 ring-blue-500/50 rotate-1' : ''}
      `}
    >
      {/* Grab Handle (2x3 dots) */}
      <div 
        {...dragHandleProps}
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-all duration-200 bg-gradient-to-r from-[#333333]/80 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4 text-gray-500 group-hover:text-gray-400 transition-colors" />
      </div>
      
      <div className="p-3 pl-7 flex flex-col gap-1">
        {/* Header: Title and Date */}
        <div className="flex justify-between items-start">
          <h3 className={`text-sm font-medium truncate pr-2 ${isSelected ? 'text-white' : 'text-gray-300'}`}>
            {draft.name}
          </h3>
          <span className="text-[10px] text-gray-500 whitespace-nowrap transition-transform duration-300 ease-in-out group-hover:translate-y-4">{dateStr}</span>
        </div>
        
        {/* Metrics Row (Always Visible - Colorful Compact Mode) */}
        <div className="flex items-center gap-3 mt-1 text-[10px] font-medium tracking-tight">
          {/* Storage (Total) - Green */}
          <div className="flex items-center gap-1 text-green-500" title={`Total: ${formatBytes(totalSize)}`}>
            <HardDrive size={12} />
            <span>{formatBytes(totalSize)}</span>
          </div>

          {/* Source Count - Blue */}
          <div className="flex items-center gap-1 text-blue-400" title={`${draft.metrics?.sourceCount || 0} Source Videos`}>
            <Film size={12} />
            <span>{draft.metrics?.sourceCount || 0}</span>
          </div>

          {/* Subtitle Count - Gray/White/Theme */}
          <div className="flex items-center gap-1 text-gray-400" title={`${draft.metrics?.subtitleCount || 0} Subtitle Lines`}>
            <FileText size={12} />
            <span>{draft.metrics?.subtitleCount || 0}</span>
          </div>

          {/* Render Count - Magenta */}
          {(() => {
            const current = draft.metrics?.renderCount || 0;
            const lifetime = draft.metrics?.lifetimeRenderCount || 0;
            const displayLifetime = lifetime > current;
            const title = displayLifetime 
              ? `${current} Exported Videos (${lifetime} total exports)`
              : `${current} Exported Videos`;
            return (
              <div className="flex items-center gap-1 text-fuchsia-400" title={title}>
                <Clapperboard size={12} />
                <span>
                  {current}
                  {displayLifetime && <span className="text-fuchsia-500/60"> ({lifetime})</span>}
                </span>
              </div>
            );
          })()}
        </div>

        {/* Expanded Content (AI Summary) - Visible on Hover or Selection (optional) */}
        {/* Using max-h transition for smooth expansion */}
        <div className={`
          transition-all duration-300 ease-in-out overflow-hidden
          ${forceExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0 group-hover:max-h-20 group-hover:opacity-100'}
        `}>
          <div className="pt-2 text-[11px] text-gray-400 leading-snug border-t border-gray-700/50 mt-2">
            {draft.cache_summary ? (
              <p className="italic">{draft.cache_summary}</p>
            ) : (
              <p className="opacity-50">No summary available</p>
            )}
          </div>
          
          {/* Footer Status Bar in Expanded View */}
           <div className="flex justify-end pt-2">
             <div className="flex items-center gap-1 text-[10px] text-green-500">
               <CheckCircle2 size={10} />
               <span>Ready</span>
             </div>
           </div>
        </div>
      </div>
      
      {/* Action Buttons (Visible on Hover) */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
        {onRename && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRename(e);
            }}
            className="p-1.5 text-gray-500 hover:text-blue-400 bg-[#252526]/90 hover:bg-[#333333] rounded-md transition-all duration-150 hover:scale-110 shadow-sm"
            title="Rename Project"
          >
            <Pencil size={12} />
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-500 hover:text-red-400 bg-[#252526]/90 hover:bg-[#333333] rounded-md transition-all duration-150 hover:scale-110 shadow-sm"
          title="Delete Draft"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
