"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Clock } from "lucide-react";

interface ShiftTimingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onShift: (offsetMs: number) => void;
  subtitleCount: number;
}

export function ShiftTimingsDialog({ isOpen, onClose, onShift, subtitleCount }: ShiftTimingsDialogProps) {
  const [offsetSeconds, setOffsetSeconds] = useState<string>("0");
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setOffsetSeconds("0");
      setDirection("forward");
      setTimeout(() => inputRef.current?.select(), 100);
    }
  }, [isOpen]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const seconds = parseFloat(offsetSeconds);
    if (isNaN(seconds) || seconds === 0) {
      onClose();
      return;
    }
    const offsetMs = (direction === "forward" ? 1 : -1) * seconds * 1000;
    onShift(offsetMs);
    onClose();
  };

  if (!isOpen) return null;

  const parsedValue = parseFloat(offsetSeconds);
  const isValid = !isNaN(parsedValue) && parsedValue >= 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div
        ref={dialogRef}
        className="bg-[#1e1e1e] border border-[#3e3e42] rounded-lg shadow-2xl w-96"
        role="dialog"
        aria-labelledby="shift-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3e3e42]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#007acc]" />
            <h2 id="shift-title" className="text-sm font-semibold text-white">
              Shift All Timings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#3e3e42] rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-[#888]" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-xs text-[#888]">
            Shift all {subtitleCount} subtitle(s) by a fixed offset.
          </p>

          <div className="space-y-3">
            {/* Direction */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection("forward")}
                className={`flex-1 py-2 text-xs rounded border ${
                  direction === "forward"
                    ? "bg-[#007acc] border-[#007acc] text-white"
                    : "border-[#3e3e42] text-[#888] hover:border-[#555]"
                }`}
              >
                ▶ Forward (Later)
              </button>
              <button
                type="button"
                onClick={() => setDirection("backward")}
                className={`flex-1 py-2 text-xs rounded border ${
                  direction === "backward"
                    ? "bg-[#007acc] border-[#007acc] text-white"
                    : "border-[#3e3e42] text-[#888] hover:border-[#555]"
                }`}
              >
                ◀ Backward (Earlier)
              </button>
            </div>

            {/* Offset Input */}
            <div>
              <label htmlFor="offset" className="block text-xs text-[#888] mb-1">
                Offset (seconds)
              </label>
              <input
                ref={inputRef}
                id="offset"
                type="number"
                step="0.1"
                min="0"
                value={offsetSeconds}
                onChange={(e) => setOffsetSeconds(e.target.value)}
                className="w-full px-3 py-2 bg-[#2a2a2a] border border-[#3e3e42] rounded text-sm text-white focus:border-[#007acc] focus:outline-none"
                placeholder="e.g., 1.5"
              />
            </div>

            {/* Preview */}
            {isValid && parsedValue > 0 && (
              <p className="text-xs text-[#007acc]">
                All subtitles will be shifted {parsedValue}s {direction === "forward" ? "later" : "earlier"}.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs border border-[#3e3e42] rounded text-[#ccc] hover:bg-[#3e3e42]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="px-4 py-1.5 text-xs bg-[#007acc] rounded text-white hover:bg-[#005fa3] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply Shift
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
