"use client";

import React from "react";
import { QueueItem } from "@/lib/queue-manager";

interface QueuePanelProps {
  items: QueueItem[];
  isPaused: boolean;
  onPauseToggle: () => void;
  onRemove: (id: string, force?: boolean) => void;
  onDownload: (item: QueueItem) => void;
  maxItems?: number;
  className?: string;
}

export function QueuePanel({
  items,
  isPaused,
  onPauseToggle,
  onRemove,
  onDownload,
  maxItems = 5,
  className = "",
}: QueuePanelProps) {
  if (items.length === 0) {
    return (
      <div className={`bg-[#252526] border border-[#333333] rounded-sm ${className}`}>
        <div className="p-3 text-center text-xs text-[#666666]">
          No jobs in queue
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#252526] border border-[#333333] rounded-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-[#333333] bg-[#2d2d2d]">
        <span className="text-xs font-bold text-[#888888] uppercase tracking-wider">
          Queue ({items.length})
        </span>
        <button
          onClick={onPauseToggle}
          className="text-[10px] px-2 py-1 rounded-sm bg-[#3e3e42] hover:bg-[#4e4e52] text-[#cccccc] transition-colors"
        >
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>
      </div>

      {/* Items */}
      <div className="max-h-64 overflow-y-auto custom-scrollbar">
        {items.slice(0, maxItems).map(item => (
          <div 
            key={item.id} 
            className="p-2 border-b border-[#333333] text-xs text-[#cccccc] hover:bg-[#2d2d2d] transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="truncate flex-1 max-w-[180px]" title={item.file.name}>
                {item.file.name}
              </span>
              <div className="flex items-center space-x-2">
                {/* Status */}
                <span className={`text-[10px] ${
                  item.status === 'completed' ? 'text-green-500' :
                  item.status === 'failed' ? 'text-red-500' :
                  item.status === 'processing' ? 'text-[#007acc]' :
                  'text-[#666666]'
                }`}>
                  {item.status === 'processing' ? `${item.progress}%` : item.status}
                </span>
                
                {/* Retry badge for crash failures */}
                {item.retryCount && item.retryCount > 0 && (
                  <span className="text-[9px] px-1 py-0.5 bg-[#d97706] text-white rounded-sm">
                    ×{item.retryCount}
                  </span>
                )}
                
                {/* Download button for completed */}
                {item.status === 'completed' && (
                  <button
                    onClick={() => onDownload(item)}
                    className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[#2d5f2d] hover:bg-[#3e7f3e] text-white transition-colors"
                    title="Download"
                  >
                    ↓
                  </button>
                )}
                
                {/* Delete button */}
                <button
                  onClick={() => onRemove(item.id, item.status === 'processing')}
                  className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[#5f2d2d] hover:bg-[#7f3e3e] text-white transition-colors"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* Progress bar for processing items */}
            {item.status === 'processing' && (
              <div className="mt-1 h-1 bg-[#333333] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#007acc] transition-all duration-300"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            )}
            
            {/* Error message for failed items */}
            {item.status === 'failed' && item.error && (
              <div className="mt-1 text-[9px] text-red-400 truncate" title={item.error}>
                {item.error}
              </div>
            )}
          </div>
        ))}
        
        {items.length > maxItems && (
          <div className="p-2 text-center text-[10px] text-[#666666]">
            +{items.length - maxItems} more
          </div>
        )}
      </div>
    </div>
  );
}
