"use client";

import React, { useState, useEffect } from "react";
import { QueueItem } from "@/lib/queue-manager";
import { X, Layers, Download, Trash2, ChevronLeft, ChevronRight, Play, Pause, RefreshCw, CheckCircle } from "lucide-react";

interface QueueDrawerProps {
  items: QueueItem[];
  isPaused: boolean;
  onPauseToggle: () => void;
  onRemove: (id: string, force?: boolean) => void;
  onRefresh?: () => void;
  onDownload: (item: QueueItem) => void;
  width?: number;
  onWidthChange?: (width: number) => void;
  isOpen?: boolean;
  onClose?: () => void;
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
  onRefresh,
  onDownload,
  width = 300,
  onWidthChange,
  isOpen: externalIsOpen,
  onClose,
}: QueueDrawerProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const isDesktop = useIsDesktop();
  
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = (val: boolean) => {
    if (onClose && !val) onClose();
    if (externalIsOpen === undefined) setInternalIsOpen(val);
  }
  
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

  // Handle Resize
  useEffect(() => {
    if (!isResizing || !onWidthChange) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate new width relative to window right edge
      const newWidth = window.innerWidth - e.clientX;
      // Constraint min/max
      if (newWidth >= 250 && newWidth <= 600) {
        onWidthChange(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, [isResizing, onWidthChange]);

  // Helper: Calculate ETA
  const getEta = (item: QueueItem) => {
    if (item.status !== 'processing' || !item.startedAt || !item.progress || item.progress < 5) return null;
    
    const elapsed = Date.now() - item.startedAt;
    const rate = item.progress / elapsed; // progress per ms
    const remainingProgress = 100 - item.progress;
    const remainingMs = remainingProgress / rate;
    
    if (!isFinite(remainingMs)) return null;
    
    // Format duration
    const seconds = Math.floor(remainingMs / 1000);
    if (seconds < 60) return `${seconds}s left`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s left`;
  };

  const renderItem = (item: QueueItem, isCompleted: boolean = false) => {
    // Determine status label
    let statusLabel = item.status === 'pending' ? 'Queued' : 
                      item.status === 'processing' ? 'Processing...' : 
                      item.status === 'failed' ? 'Failed' : 'Completed';
    
    // Override label for progress
    if (item.status === 'processing') {
       if (item.progress > 0) statusLabel = 'Encoding...';
       else statusLabel = 'Starting...';
    }

    const eta = getEta(item);

    return (
    <div 
      key={item.id} 
      className="p-2 border-b border-[#333333] text-xs text-[#cccccc] hover:bg-[#2d2d2d] transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate flex-1 min-w-0" title={item.file.name}>
          {item.file.name}
        </span>
        <div className="flex items-center space-x-2 shrink-0">
          {/* Status Text + Percentage */}
          <div className="flex flex-col items-end">
            <span className={`text-[10px] font-medium ${
              item.status === 'processing' ? 'text-green-400' :
              item.status === 'completed' ? 'text-green-500' :
              item.status === 'failed' ? 'text-red-500' :
              'text-[#007acc]' 
            }`}>
              {/* Show Rounded Percentage only if processing/completed */}
              {item.status === 'processing' 
                ? `${Math.round(item.progress || 0)}%` 
                : statusLabel}
            </span>
            {eta && (
               <span className="text-[9px] text-[#666666] font-mono">
                 {eta}
               </span>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-1">
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
            
            <button
              onClick={() => onRemove(item.id)}
              className="p-1 rounded-sm hover:bg-[#3e3e42] hover:text-red-400 text-[#888888] transition-colors"
              title="Remove"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Progress Bar Background */}
      {(item.status === 'processing' || item.status === 'completed') && (
        <div className="mt-1 h-0.5 w-full bg-[#333333] overflow-hidden rounded-full">
          <div 
            className={`h-full ${item.status === 'completed' ? 'bg-green-500' : 'bg-[#007acc]'} transition-all duration-300`}
            style={{ width: `${item.progress || 0}%` }}
          />
        </div>
      )}
    </div>
    );
  };

  // Shared panel content component
  const renderPanelContent = (showCloseButton: boolean = false) => (
    <>
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#333333] bg-[#2d2d2d] shrink-0">
        <h2 className="text-sm font-bold text-[#e1e1e1] uppercase tracking-wider">
          Job Queue
        </h2>
        
        {/* Only show pause toggle here for desktop if needed, or in Action bar */}
        <div className="flex items-center space-x-2">
            <button 
                onClick={onPauseToggle}
                className="flex items-center gap-1 text-xs hover:text-white text-[#aaaaaa] transition-colors"
                title={isPaused ? "Resume Queue" : "Pause Queue"}
            >
                {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                {isPaused ? "RESUME" : "PAUSE"}
            </button>
            
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
      </div>

      {/* Queue Section - 67% */}
      <div className="flex-[2] flex flex-col min-h-0 border-b border-[#333333]">
        <div className="flex items-center justify-between p-2 border-b border-[#333333] bg-[#252526] shrink-0">
          <span className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">
            Queue ({queueItems.length})
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-sm bg-[#3e3e42] hover:bg-[#4e4e52] text-[#cccccc] transition-colors"
              title="Refresh Queue"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1e1e1e]">
          {queueItems.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#555555]">
              No pending jobs
            </div>
          ) : (
            queueItems.map(item => renderItem(item))
          )}
        </div>
      </div>

      {/* Completed Section - 33% */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between p-2 border-b border-[#333333] bg-[#252526] shrink-0">
          <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">
            Completed ({completedItems.length})
          </span>
          {completedItems.length > 0 && (
             <button
               onClick={() => completedItems.forEach(i => onRemove(i.id))}
               className="text-[10px] text-[#888888] hover:text-[#cccccc]"
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
      {/* MOBILE: Toggle Button - Only show on mobile, floating */}
      <div className="lg:hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed top-3 right-3 z-50 flex items-center space-x-2 px-3 py-2 bg-[#2d2d2d] hover:bg-[#3e3e42] border border-[#444444] rounded-sm shadow-lg transition-all"
          title="Job Queue"
        >
          <Layers className="w-4 h-4 text-[#cccccc]" />
          {/* Mobile badges can go here if needed */}
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
      </div>

      {/* MOBILE: Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* DESKTOP: Inline Panel - only show if isOpen */}
      {isOpen && (
        <div 
          className="hidden lg:flex flex-col shrink-0 border-l border-[#333333] h-full bg-[#1e1e1e] relative"
          style={{ width: width }}
        >
          {/* Resize Handle */}
          <div
              className="absolute left-0 top-0 bottom-0 w-1 hover:bg-[#007acc] cursor-ew-resize z-10 transition-colors"
              onMouseDown={() => setIsResizing(true)}
          />
          
          {renderPanelContent(false)}
        </div>
      )}

      {/* MOBILE: Slide-out Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-80 max-w-[90vw] bg-[#1e1e1e] border-l border-[#333333] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col lg:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {renderPanelContent(true)}
      </div>
    </>
  );
}
