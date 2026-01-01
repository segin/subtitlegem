"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutCategory {
  title: string;
  shortcuts: { keys: string; description: string }[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: "File",
    shortcuts: [
      { keys: "Ctrl+N", description: "New Project" },
      { keys: "Ctrl+O", description: "Open Project" },
      { keys: "Ctrl+S", description: "Save Project" },
    ],
  },
  {
    title: "Edit",
    shortcuts: [
      { keys: "Ctrl+Z", description: "Undo" },
      { keys: "Ctrl+Y", description: "Redo" },
      { keys: "Ctrl+X", description: "Cut Subtitle(s)" },
      { keys: "Ctrl+C", description: "Copy Subtitle(s)" },
      { keys: "Ctrl+V", description: "Paste Subtitle(s)" },
      { keys: "Ctrl+H", description: "Find & Replace" },
      { keys: "Delete", description: "Delete Selected" },
    ],
  },
  {
    title: "Playback",
    shortcuts: [
      { keys: "Space", description: "Play / Pause" },
      { keys: "←", description: "Seek Back 5s" },
      { keys: "→", description: "Seek Forward 5s" },
      { keys: "J", description: "Seek Back 10s" },
      { keys: "L", description: "Seek Forward 10s" },
      { keys: "Home", description: "Go to Start" },
      { keys: "End", description: "Go to End" },
    ],
  },
  {
    title: "Timeline",
    shortcuts: [
      { keys: "Ctrl++", description: "Zoom In" },
      { keys: "Ctrl+-", description: "Zoom Out" },
      { keys: "Ctrl+0", description: "Reset Zoom" },
      { keys: "Shift+Click", description: "Select Range" },
      { keys: "Ctrl+Click", description: "Toggle Selection" },
      { keys: "Ctrl+A", description: "Select All" },
    ],
  },
  {
    title: "Subtitle Editing",
    shortcuts: [
      { keys: "Enter", description: "Edit Selected Subtitle" },
      { keys: "Escape", description: "Cancel Edit / Close Dialog" },
      { keys: "Tab", description: "Next Subtitle" },
      { keys: "Shift+Tab", description: "Previous Subtitle" },
    ],
  },
];

export function KeyboardShortcutsDialog({ isOpen, onClose }: KeyboardShortcutsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div
        ref={dialogRef}
        className="bg-[#1e1e1e] border border-[#3e3e42] rounded-lg shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
        role="dialog"
        aria-labelledby="shortcuts-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3e3e42]">
          <h2 id="shortcuts-title" className="text-lg font-semibold text-white">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#3e3e42] rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-[#888]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SHORTCUT_CATEGORIES.map((category) => (
              <div key={category.title} className="space-y-2">
                <h3 className="text-sm font-medium text-[#007acc] uppercase tracking-wide">
                  {category.title}
                </h3>
                <div className="space-y-1">
                  {category.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.keys}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[#2a2a2a]"
                    >
                      <span className="text-sm text-[#ccc]">{shortcut.description}</span>
                      <kbd className="px-2 py-0.5 text-xs bg-[#333] border border-[#555] rounded text-[#aaa] font-mono">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#3e3e42] bg-[#252526]">
          <p className="text-xs text-[#888] text-center">
            Press <kbd className="px-1.5 py-0.5 bg-[#333] border border-[#555] rounded text-[#aaa] font-mono">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}
