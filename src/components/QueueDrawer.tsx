"use client";

import React, { useState, useEffect } from "react";
import { QueueItem } from "@/lib/queue-manager";
import { X, Layers, Download, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

interface QueueDrawerProps {
  items: QueueItem[];
  isPaused: boolean;
  onPauseToggle: () => void;
  onRemove: (id: string, force?: boolean) => void;
  onDownload: (item: QueueItem) => void;
}

// Custom hook to detect desktop (lg breakpoint = 1024px)
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  return isDesktop;
}

export function QueueDrawer({
  items,
  isPaused,
  onPauseToggle,
  onRemove,
  onDownload,
}: QueueDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isDesktop = useIsDesktop();
  
  // Close drawer on escape (mobile only)
  useEffect(() => {
    if (isDesktop) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isDesktop]);

  // Separate items: queue (pending/processing/failed) vs completed
  const queueItems = items.filter(i => i.status !== 'completed');
  const completedItems = items.filter(i => i.status === 'completed');
  
  // Badge counts
  const pendingCount = items.filter(i => i.status === 'pending').length;
  const processingCount = items.filter(i => i.status === 'processing').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  const renderItem = (item: QueueItem, isCompleted: boolean = false) => (
    <div 
      key={item.id} 
      className="p-2 border-b border-[#333333] text-xs text-[#cccccc] hover:bg-[#2d2d2d] transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="truncate flex-1 max-w-[160px]" title={item.file.name}>
          {item.file.name}
        </span>
        <div className="flex items-center space-x-1.5">
          {/* Status indicator */}
          <span className={`text-[10px] font-medium ${
            item.status === 'processing' ? 'text-green-400' :
            item.status === 'completed' ? 'text-green-500' :
            item.status === 'failed' ? 'text-red-500' :
            'text-[#007acc]' // pending = blue
          }`}>
            {item.status === 'processing' ? `${item.progress}%` : 
             item.status === 'completed' ? '✓' :
             item.status === 'failed' ? '✕' : 'pending'}
          </span>
          
          {/* Retry badge */}
          {item.retryCount && item.retryCount > 0 && (
            <span className="text-[9px] px-1 py-0.5 bg-[#d97706] text-white rounded-sm">
              ×{item.retryCount}
            </span>
          )}
          
          {/* Download for completed */}
          {isCompleted && (
            <button
              onClick={() => onDownload(item)}
              className="p-1 rounded-sm bg-[#2d5f2d] hover:bg-[#3e7f3e] text-white transition-colors"
              title="Download"
            >
              <Download className="w-3 h-3" />
            </button>
          )}
          
          {/* Delete */}
          <button
            onClick={() => onRemove(item.id, item.status === 'processing')}
            className="p-1 rounded-sm bg-[#5f2d2d] hover:bg-[#7f3e3e] text-white transition-colors"
            title="Remove"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      
      {/* Progress bar */}
      {item.status === 'processing' && (
        <div className="mt-1.5 h-1 bg-[#333333] rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      )}
      
      {/* Error */}
      {item.status === 'failed' && item.error && (
        <div className="mt-1 text-[9px] text-red-400 truncate" title={item.error}>
          {item.error}
        </div>
      )}
    </div>
  );

  // Shared panel content component
  const renderPanelContent = (showCloseButton: boolean = false) => (
    <>
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#333333] bg-[#2d2d2d] shrink-0">
        <h2 className="text-sm font-bold text-[#e1e1e1] uppercase tracking-wider">
          Job Queue
        </h2>
        {showCloseButton && (
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-[#3e3e42] rounded-sm transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-[#888888]" />
          </button>
        )}
      </div>

      {/* Queue Section - 67% */}
      <div className="flex-[2] flex flex-col min-h-0 border-b border-[#333333]">
        <div className="flex items-center justify-between p-2 border-b border-[#333333] bg-[#252526] shrink-0">
          <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">
            Queue ({queueItems.length})
          </span>
          <button
            onClick={onPauseToggle}
            className="text-[10px] px-2 py-1 rounded-sm bg-[#3e3e42] hover:bg-[#4e4e52] text-[#cccccc] transition-colors"
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1e1e1e]">
          {queueItems.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#666666]">
              No jobs in queue
            </div>
          ) : (
            queueItems.map(item => renderItem(item, false))
          )}
        </div>
      </div>

      {/* Completed Section - 33% */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between p-2 border-b border-[#333333] bg-[#252526] shrink-0">
          <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">
            ✓ Completed ({completedItems.length})
          </span>
          {completedItems.length > 0 && (
            <button
              onClick={() => completedItems.forEach(i => onRemove(i.id))}
              className="text-[9px] px-2 py-1 rounded-sm bg-[#3e3e42] hover:bg-[#4e4e52] text-[#888888] transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1a1a1a]">
          {completedItems.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#555555]">
              No completed jobs
            </div>
          ) : (
            completedItems.map(item => renderItem(item, true))
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* MOBILE: Toggle Button - Only show on mobile */}
      {!isDesktop && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed top-3 right-3 z-50 flex items-center space-x-2 px-3 py-2 bg-[#2d2d2d] hover:bg-[#3e3e42] border border-[#444444] rounded-sm shadow-lg transition-all"
          title="Job Queue"
        >
          <Layers className="w-4 h-4 text-[#cccccc]" />
          
          {items.length > 0 && (
            <div className="flex items-center space-x-1">
              {pendingCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-[#007acc] text-white rounded-full font-bold">
                  {pendingCount}
                </span>
              )}
              {processingCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded-full font-bold animate-pulse">
                  {processingCount}
                </span>
              )}
              {failedCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded-full font-bold">
                  {failedCount}
                </span>
              )}
              {completedItems.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 border border-green-500 text-green-500 rounded-full font-bold">
                  {completedItems.length}
                </span>
              )}
            </div>
          )}
          
          {items.length === 0 && (
            <span className="text-xs text-[#888888]">Queue</span>
          )}
        </button>
      )}

      {/* MOBILE: Backdrop - Only show when drawer open on mobile */}
      {!isDesktop && isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* DESKTOP: Inline Panel - Part of document flow, collapsible */}
      {isDesktop && (
        <div className={`h-full bg-[#1e1e1e] border-l border-[#333333] flex flex-col shrink-0 order-last transition-all duration-300 ${isCollapsed ? 'w-10' : 'w-72 xl:w-80'}`}>
          {/* Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute top-2 left-0 transform -translate-x-1/2 z-10 w-5 h-10 bg-[#333333] border border-[#454545] rounded-l flex items-center justify-center hover:bg-[#3e3e42] transition-colors"
            title={isCollapsed ? "Expand queue" : "Collapse queue"}
          >
            {isCollapsed ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          
          {isCollapsed ? (
            /* Collapsed view - just icon and count */
            <div className="flex flex-col items-center py-3 gap-2">
              <Layers className="w-5 h-5 text-[#888888]" />
              {queueItems.length > 0 && (
                <span className="text-xs font-bold text-[#0e639c]">{queueItems.length}</span>
              )}
            </div>
          ) : (
            renderPanelContent(false)
          )}
        </div>
      )}

      {/* MOBILE: Slide-out Drawer */}
      {!isDesktop && (
        <div 
          className={`fixed top-0 right-0 h-full w-80 max-w-[90vw] bg-[#1e1e1e] border-l border-[#333333] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {renderPanelContent(true)}
        </div>
      )}
    </>
  );
}
