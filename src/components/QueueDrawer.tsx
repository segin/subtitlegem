"use client";

import React, { useState, useEffect } from "react";
import { QueueItem } from "@/lib/queue-manager";
import { X, Layers } from "lucide-react";
import { QueuePanel } from "./QueuePanel";

interface QueueDrawerProps {
  items: QueueItem[];
  isPaused: boolean;
  onPauseToggle: () => void;
  onRemove: (id: string, force?: boolean) => void;
  onDownload: (item: QueueItem) => void;
}

export function QueueDrawer({
  items,
  isPaused,
  onPauseToggle,
  onRemove,
  onDownload,
}: QueueDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Close drawer on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const activeCount = items.filter(i => i.status === 'processing' || i.status === 'pending').length;
  const completedCount = items.filter(i => i.status === 'completed').length;
  const failedCount = items.filter(i => i.status === 'failed').length;

  return (
    <>
      {/* Toggle Button - Fixed in top-right */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-3 right-3 z-50 flex items-center space-x-2 px-3 py-2 bg-[#2d2d2d] hover:bg-[#3e3e42] border border-[#444444] rounded-sm shadow-lg transition-all"
        title="Job Queue"
      >
        <Layers className="w-4 h-4 text-[#cccccc]" />
        
        {/* Job count badge */}
        {items.length > 0 && (
          <div className="flex items-center space-x-1">
            {activeCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-[#007acc] text-white rounded-full font-bold">
                {activeCount}
              </span>
            )}
            {completedCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded-full font-bold">
                {completedCount}
              </span>
            )}
            {failedCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded-full font-bold">
                {failedCount}
              </span>
            )}
          </div>
        )}
        
        {items.length === 0 && (
          <span className="text-xs text-[#888888]">Queue</span>
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-80 max-w-[90vw] bg-[#1e1e1e] border-l border-[#333333] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-3 border-b border-[#333333] bg-[#2d2d2d]">
          <h2 className="text-sm font-bold text-[#e1e1e1] uppercase tracking-wider">
            Job Queue
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-[#3e3e42] rounded-sm transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-[#888888]" />
          </button>
        </div>

        {/* Queue Content */}
        <div className="h-[calc(100%-48px)] overflow-hidden">
          <QueuePanel
            items={items}
            isPaused={isPaused}
            onPauseToggle={onPauseToggle}
            onRemove={onRemove}
            onDownload={onDownload}
            maxItems={20}
            className="h-full border-0 rounded-none"
          />
        </div>
      </div>
    </>
  );
}
