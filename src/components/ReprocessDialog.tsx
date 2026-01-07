"use client";

import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, X, Settings2, AlertTriangle } from "lucide-react";
import { getCachedModelResult } from "@/lib/model-cache";
import { SubtitleLine } from "@/types/subtitle";

interface ReprocessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  subtitleCount: number;
  currentModel: string;
  currentSecondaryLanguage: string;
  onReprocess: (options: ReprocessOptions) => Promise<SubtitleLine[]>;
}

export interface ReprocessOptions {
  model: string;
  secondaryLanguage: string;
  mode: 'replace' | 'merge';
  // Advanced options
  sampleDuration?: number;
  promptHints?: string;
}

export function ReprocessDialog({
  isOpen,
  onClose,
  subtitleCount,
  currentModel,
  currentSecondaryLanguage,
  onReprocess,
}: ReprocessDialogProps) {
  // Form state
  const [model, setModel] = useState(currentModel || "gemini-2.5-flash");
  const [secondaryLanguage, setSecondaryLanguage] = useState(currentSecondaryLanguage || "");
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  
  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sampleDuration, setSampleDuration] = useState<number | null>(null);
  const [promptHints, setPromptHints] = useState("");
  
  // UI state
  const [availableModels, setAvailableModels] = useState<{name: string; displayName: string}[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load models on open
  useEffect(() => {
    if (isOpen) {
      setLoadingModels(true);
      setError(null);
      fetch('/api/models')
        .then(res => res.json())
        .then(data => {
          if (data.models) {
            // Filter out models known to fail (hide completely, don't gray out)
            const filtered = data.models.filter((m: { name: string }) => {
              const cached = getCachedModelResult(m.name);
              return cached !== false;
            });
            setAvailableModels(filtered);
          }
        })
        .catch(err => {
          console.error("Failed to load models", err);
          setError("Failed to load available models");
        })
        .finally(() => setLoadingModels(false));

      // Reset form state when opening
      setModel(currentModel || "gemini-2.5-flash");
      setSecondaryLanguage(currentSecondaryLanguage || "");
      setMode('replace');
      setShowAdvanced(false);
      setSampleDuration(null);
      setPromptHints("");
    }
  }, [isOpen, currentModel, currentSecondaryLanguage]);

  const handleReprocess = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      await onReprocess({
        model,
        secondaryLanguage,
        mode,
        sampleDuration: sampleDuration || undefined,
        promptHints: promptHints || undefined,
      });
      onClose();
    } catch (err: any) {
      console.error("Reprocess failed:", err);
      setError(err.message || "Reprocessing failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [model, secondaryLanguage, mode, sampleDuration, promptHints, onReprocess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#252526] border border-[#3e3e42] shadow-2xl w-full max-w-md rounded-sm flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-10 bg-[#333333] flex items-center justify-between px-3 border-b border-[#454545]">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[#888888]" />
            <span className="text-sm font-medium text-[#e1e1e1]">Reprocess Video</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#454545] rounded transition-colors">
            <X className="w-4 h-4 text-[#888888]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-[#3d2f00] border border-[#5c4800] rounded text-xs">
            <AlertTriangle className="w-4 h-4 text-[#ffc107] shrink-0 mt-0.5" />
            <div className="text-[#e0c060]">
              <strong>{subtitleCount} subtitle{subtitleCount !== 1 ? 's' : ''}</strong> will be affected.
              This action can be undone with <kbd className="px-1 py-0.5 bg-[#1e1e1e] rounded text-[10px]">Ctrl+Z</kbd>.
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#888888]">AI Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loadingModels}
              className="w-full bg-[#1e1e1e] border border-[#3e3e42] rounded px-3 py-1.5 text-sm focus:border-[#007fd4] outline-none text-[#ccc]"
            >
              {availableModels.length > 0 ? (
                availableModels.map(m => (
                  <option key={m.name} value={m.name}>{m.displayName}</option>
                ))
              ) : (
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Default)</option>
              )}
            </select>
          </div>

          {/* Secondary Language */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#888888]">Secondary Language (Translation)</label>
            <input
              value={secondaryLanguage}
              onChange={(e) => setSecondaryLanguage(e.target.value)}
              placeholder="e.g. English, Spanish, Chinese (leave blank for none)"
              className="w-full bg-[#1e1e1e] border border-[#3e3e42] rounded px-3 py-1.5 text-sm focus:border-[#007fd4] outline-none text-[#ccc] placeholder:text-[#555]"
            />
          </div>

          {/* Mode Selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#888888]">Subtitle Handling</label>
            <div className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                  className="mt-0.5 accent-[#007acc]"
                />
                <div>
                  <div className="text-sm text-[#e1e1e1] group-hover:text-white">Replace all subtitles</div>
                  <div className="text-[10px] text-[#666]">Discard existing subtitles and timing edits</div>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'merge'}
                  onChange={() => setMode('merge')}
                  className="mt-0.5 accent-[#007acc]"
                />
                <div>
                  <div className="text-sm text-[#e1e1e1] group-hover:text-white">Update text only</div>
                  <div className="text-[10px] text-[#666]">Keep your timing edits, refresh transcription text</div>
                </div>
              </label>
            </div>
          </div>

          {/* Advanced Options Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-[#007acc] hover:text-[#1a9fff]"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </button>

          {/* Advanced Options Panel */}
          {showAdvanced && (
            <div className="space-y-3 p-3 bg-[#1e1e1e] border border-[#3e3e42] rounded">
              {/* Sample Mode */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs text-[#888888]">
                  <input
                    type="checkbox"
                    checked={sampleDuration !== null}
                    onChange={(e) => setSampleDuration(e.target.checked ? 10 : null)}
                    className="accent-[#007acc]"
                  />
                  Sample mode (process first N seconds only)
                </label>
                {sampleDuration !== null && (
                  <select
                    value={sampleDuration}
                    onChange={(e) => setSampleDuration(Number(e.target.value))}
                    className="w-full bg-[#252526] border border-[#3e3e42] rounded px-2 py-1 text-xs text-[#ccc]"
                  >
                    <option value={2}>2 seconds</option>
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                    <option value={30}>30 seconds</option>
                  </select>
                )}
              </div>

              {/* Custom Prompt Hints */}
              <div className="space-y-1.5">
                <label className="text-xs text-[#888888]">Custom Prompt Hints</label>
                <textarea
                  value={promptHints}
                  onChange={(e) => setPromptHints(e.target.value)}
                  placeholder="e.g. This video contains technical jargon about machine learning..."
                  rows={2}
                  className="w-full bg-[#252526] border border-[#3e3e42] rounded px-2 py-1.5 text-xs text-[#ccc] placeholder:text-[#555] resize-none"
                />
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-2 bg-red-900/30 border border-red-500/50 rounded text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-3 border-t border-[#333333] bg-[#2d2d2d]">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-1.5 text-xs text-[#cccccc] hover:bg-[#3e3e42] transition-colors border border-[#3e3e42] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReprocess}
            disabled={isProcessing || loadingModels}
            className="px-4 py-1.5 text-xs bg-[#0e639c] text-white hover:bg-[#1177bb] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isProcessing && <RefreshCw className="w-3 h-3 animate-spin" />}
            {isProcessing ? 'Processing...' : 'Reprocess'}
          </button>
        </div>
      </div>
    </div>
  );
}
