
import React from 'react';
import { HardDrive, Film, FileText, Clapperboard, CheckCircle2, Trash2 } from 'lucide-react';
import { DraftItem } from '@/hooks/useHomeState';
import { formatBytes } from '@/lib/format-utils';

interface ProjectCardProps {
  draft: DraftItem;
  isSelected: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export function ProjectCard({ draft, isSelected, onClick, onDelete }: ProjectCardProps) {
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
      className={`
        group relative w-full mb-2 rounded-lg border transition-all duration-200 cursor-pointer overflow-hidden
        ${isSelected 
          ? 'bg-[#37373d] border-l-4 border-l-blue-500 border-y-transparent border-r-transparent' 
          : 'bg-[#252526] border-transparent hover:bg-[#2a2d2e]'}
      `}
    >
      <div className="p-3 flex flex-col gap-1">
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
        <div className="
          max-h-0 opacity-0 group-hover:max-h-20 group-hover:opacity-100 
          transition-all duration-300 ease-in-out overflow-hidden
        ">
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
      
      {/* Delete Button (Visible on Hover) */}
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity bg-[#252526]/80 rounded"
        title="Delete Draft"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
