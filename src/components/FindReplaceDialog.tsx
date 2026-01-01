"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Search, Replace, ChevronDown, ChevronUp } from "lucide-react";

interface FindReplaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFind: (query: string, options: FindOptions) => FindResult | null;
  onReplace: (query: string, replacement: string, options: FindOptions) => number;
  onReplaceAll: (query: string, replacement: string, options: FindOptions) => number;
  onFindNext: () => FindResult | null;
  onFindPrevious: () => FindResult | null;
}

export interface FindOptions {
  caseSensitive: boolean;
  searchPrimary: boolean;
  searchSecondary: boolean;
}

export interface FindResult {
  subtitleId: string;
  field: "primary" | "secondary";
  index: number;
  total: number;
}

export function FindReplaceDialog({
  isOpen,
  onClose,
  onFind,
  onReplace,
  onReplaceAll,
  onFindNext,
  onFindPrevious,
}: FindReplaceDialogProps) {
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [searchPrimary, setSearchPrimary] = useState(true);
  const [searchSecondary, setSearchSecondary] = useState(true);
  const [currentResult, setCurrentResult] = useState<FindResult | null>(null);
  const [lastAction, setLastAction] = useState<string>("");

  const findInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus find input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => findInputRef.current?.focus(), 100);
      setCurrentResult(null);
      setLastAction("");
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

  const getOptions = useCallback((): FindOptions => ({
    caseSensitive,
    searchPrimary,
    searchSecondary,
  }), [caseSensitive, searchPrimary, searchSecondary]);

  const handleFind = () => {
    if (!findText.trim()) return;
    const result = onFind(findText, getOptions());
    setCurrentResult(result);
    setLastAction(result ? `Found ${result.index + 1} of ${result.total}` : "No matches found");
  };

  const handleFindNext = () => {
    const result = onFindNext();
    setCurrentResult(result);
    if (result) {
      setLastAction(`Found ${result.index + 1} of ${result.total}`);
    }
  };

  const handleFindPrevious = () => {
    const result = onFindPrevious();
    setCurrentResult(result);
    if (result) {
      setLastAction(`Found ${result.index + 1} of ${result.total}`);
    }
  };

  const handleReplace = () => {
    if (!findText.trim()) return;
    const count = onReplace(findText, replaceText, getOptions());
    setLastAction(count > 0 ? "Replaced 1 occurrence" : "No match to replace");
    // Auto-find next after replace
    if (count > 0) {
      handleFindNext();
    }
  };

  const handleReplaceAll = () => {
    if (!findText.trim()) return;
    const count = onReplaceAll(findText, replaceText, getOptions());
    setLastAction(`Replaced ${count} occurrence(s)`);
    setCurrentResult(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        handleFindPrevious();
      } else {
        handleFind();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-16 right-4 z-50">
      <div
        ref={dialogRef}
        className="bg-[#1e1e1e] border border-[#3e3e42] rounded-lg shadow-2xl w-80"
        role="dialog"
        aria-labelledby="find-replace-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#3e3e42]">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[#007acc]" />
            <h2 id="find-replace-title" className="text-xs font-semibold text-white">
              Find & Replace
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
        <div className="p-3 space-y-3">
          {/* Find Input */}
          <div className="flex gap-1">
            <input
              ref={findInputRef}
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Find..."
              className="flex-1 px-2 py-1.5 bg-[#2a2a2a] border border-[#3e3e42] rounded text-xs text-white focus:border-[#007acc] focus:outline-none"
            />
            <button
              onClick={handleFindPrevious}
              disabled={!currentResult}
              className="p-1.5 border border-[#3e3e42] rounded hover:bg-[#3e3e42] disabled:opacity-50"
              title="Find Previous"
            >
              <ChevronUp className="w-3 h-3 text-[#ccc]" />
            </button>
            <button
              onClick={handleFindNext}
              disabled={!currentResult}
              className="p-1.5 border border-[#3e3e42] rounded hover:bg-[#3e3e42] disabled:opacity-50"
              title="Find Next"
            >
              <ChevronDown className="w-3 h-3 text-[#ccc]" />
            </button>
          </div>

          {/* Replace Input */}
          <div className="flex gap-1">
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replace with..."
              className="flex-1 px-2 py-1.5 bg-[#2a2a2a] border border-[#3e3e42] rounded text-xs text-white focus:border-[#007acc] focus:outline-none"
            />
            <button
              onClick={handleReplace}
              disabled={!findText.trim()}
              className="px-2 py-1.5 text-[10px] border border-[#3e3e42] rounded text-[#ccc] hover:bg-[#3e3e42] disabled:opacity-50"
            >
              Replace
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={!findText.trim()}
              className="px-2 py-1.5 text-[10px] border border-[#3e3e42] rounded text-[#ccc] hover:bg-[#3e3e42] disabled:opacity-50"
            >
              All
            </button>
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-2 text-[10px]">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="w-3 h-3"
              />
              <span className="text-[#888]">Case sensitive</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={searchPrimary}
                onChange={(e) => setSearchPrimary(e.target.checked)}
                className="w-3 h-3"
              />
              <span className="text-[#888]">Primary</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={searchSecondary}
                onChange={(e) => setSearchSecondary(e.target.checked)}
                className="w-3 h-3"
              />
              <span className="text-[#888]">Secondary</span>
            </label>
          </div>

          {/* Status */}
          {lastAction && (
            <p className="text-[10px] text-[#888]">{lastAction}</p>
          )}

          {/* Find Button */}
          <button
            onClick={handleFind}
            disabled={!findText.trim()}
            className="w-full py-1.5 text-xs bg-[#007acc] rounded text-white hover:bg-[#005fa3] disabled:opacity-50"
          >
            Find
          </button>
        </div>
      </div>
    </div>
  );
}
