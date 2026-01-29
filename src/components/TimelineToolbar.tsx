"use client";

import React from 'react';
import { Scissors, Trash2, Copy } from 'lucide-react';

interface TimelineToolbarProps {
  onSplitMode: () => void;
  isSplitMode: boolean;
  onDeleteSelected?: () => void;
  onDuplicateSelected?: () => void;
  hasSelection: boolean;
  className?: string;
}

export function TimelineToolbar({
  onSplitMode,
  isSplitMode,
  onDeleteSelected,
  onDuplicateSelected,
  hasSelection,
  className = ''
}: TimelineToolbarProps) {
  return (
    <div className={`flex items-center gap-1 px-2 py-1 bg-[#252526] border-b border-[#333333] ${className}`}>
      {/* Split Tool */}
      <button
        onClick={onSplitMode}
        className={`p-1.5 rounded transition-colors ${
          isSplitMode 
            ? 'bg-[#007acc] text-white' 
            : 'text-[#cccccc] hover:bg-[#3e3e42]'
        }`}
        title="Split Clip (S)"
      >
        <Scissors className="w-4 h-4" />
      </button>

      <div className="w-px h-4 bg-[#444444] mx-1" />

      {/* Duplicate Selected */}
      <button
        onClick={onDuplicateSelected}
        disabled={!hasSelection || !onDuplicateSelected}
        className={`p-1.5 rounded transition-colors ${
          hasSelection && onDuplicateSelected
            ? 'text-[#cccccc] hover:bg-[#3e3e42]'
            : 'text-[#555555] cursor-not-allowed'
        }`}
        title="Duplicate Selected Clip (Ctrl+D)"
      >
        <Copy className="w-4 h-4" />
      </button>

      {/* Delete Selected */}
      <button
        onClick={onDeleteSelected}
        disabled={!hasSelection || !onDeleteSelected}
        className={`p-1.5 rounded transition-colors ${
          hasSelection && onDeleteSelected
            ? 'text-[#cccccc] hover:bg-red-600/20 hover:text-red-400'
            : 'text-[#555555] cursor-not-allowed'
        }`}
        title="Delete Selected Clip (Del)"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {isSplitMode && (
        <div className="ml-2 text-xs text-[#cccccc] bg-[#007acc]/20 px-2 py-1 rounded">
          Click on a clip to split at that position
        </div>
      )}
    </div>
  );
}
