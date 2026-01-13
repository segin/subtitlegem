"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AlertCircle, RefreshCw, X, Settings, Play, ChevronDown, Check, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { loadModels } from "@/lib/model-cache";
import { PreviewDialog } from './PreviewDialog';
import { SubtitleLine } from "@/types/subtitle";

export interface ReprocessOptions {
  model: string;
  secondaryLanguage: string;
  mode: 'replace' | 'merge';
  sampleDuration?: number;
  promptHints?: string;
}

interface ReprocessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  subtitleCount: number;
  currentModel?: string;
  currentSecondaryLanguage?: string;
  onReprocess: (options: ReprocessOptions) => Promise<any>;
  videoPath?: string | null;
}

export function ReprocessDialog({
  isOpen,
  onClose,
  subtitleCount,
  currentModel,
  currentSecondaryLanguage,
  onReprocess,
  videoPath,
}: ReprocessDialogProps) {
  // Form state
  const [model, setModel] = useState(currentModel || "gemini-2.5-flash");
  const [secondaryLanguage, setSecondaryLanguage] = useState(currentSecondaryLanguage || "");
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  
  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [promptHints, setPromptHints] = useState("");
  
  // UI state
  const [availableModels, setAvailableModels] = useState<{name: string; displayName: string}[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Preview State
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewDuration, setPreviewDuration] = useState(10); // Default 10s
  const [showDurationMenu, setShowDurationMenu] = useState(false);
  const [previewSubtitles, setPreviewSubtitles] = useState<SubtitleLine[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewVideoPath, setPreviewVideoPath] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
        // Load models
        setLoadingModels(true);
        loadModels()
            .then(models => {
                // Filter out failed models
                const validModels = models.filter(m => !m.displayName.includes("(Failed)"));
                setAvailableModels(validModels);
            })
            .catch(console.error)
            .finally(() => setLoadingModels(false));
            
        // Reset advanced options if needed
        setShowAdvanced(false);
        setPromptHints("");
    }
  }, [isOpen]);

  const handleReprocess = async () => {
    setIsProcessing(true);
    setError(null);
    try {
        await onReprocess({
            model,
            secondaryLanguage,
            mode,
            promptHints: promptHints || undefined
        });
        onClose();
    } catch (e: any) {
        setError(e.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setShowPreviewDialog(true);
    setError(null);
    
    try {
        if (!videoPath) {
            throw new Error("No video loaded");
        }
        
        const response = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'reprocess',
                filePath: videoPath, 
                // We use sampleDuration to trigger the slicing logic
                sampleDuration: previewDuration, 
                model,
                secondaryLanguage: secondaryLanguage === "None" ? undefined : secondaryLanguage,
                promptHints: promptHints || undefined
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Preview generation failed");
        }
        
        const data = await response.json();
        setPreviewSubtitles(data.subtitles || []);
        
        // If the server provides a way to serve the temp sample, set it here.
        // For security/simplicity we might not serve the file back yet.
        // setPreviewVideoPath(data.videoPath); 
        
    } catch (err: any) {
        console.error(err);
        setError(err.message);
        // Don't close dialog on error so user can see what happened (maybe add error state to preview dialog?)
    } finally {
        setPreviewLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#252526] border-[#454545] text-[#cccccc] p-0 gap-0 max-w-[400px] shadow-xl">
        <DialogHeader className="p-4 border-b border-[#333]">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#888]" />
              Reprocess Video
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
           {/* Warning Box */}
           <div className="bg-[#3d2f00] border border-[#5c4800] text-[#dcdcaa] px-3 py-2 rounded text-xs flex items-center gap-2">
               <AlertTriangle className="w-4 h-4 text-[#ffc107]" />
               <span>{subtitleCount} subtitles will be affected. Undo with Ctrl+Z</span>
           </div>

           {/* Model Selection */}
           <div className="space-y-1">
             <label className="text-[10px] uppercase font-bold text-[#666666] tracking-wider">AI Model</label>
             <select
               value={model}
               onChange={(e) => setModel(e.target.value)}
               disabled={loadingModels}
               className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-xs p-2 focus:border-[#007acc] outline-none rounded-sm"
             >
                {loadingModels ? <option>Loading models...</option> : 
                    availableModels.length > 0 ? (
                        availableModels.map(m => (
                            <option key={m.name} value={m.name}>{m.displayName}</option>
                        ))
                    ) : (
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash (Default)</option>
                    )
                }
             </select>
           </div>

           {/* Secondary Language */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-[#666666] tracking-wider">Secondary Language (Translation)</label>
              <select
                value={secondaryLanguage}
                onChange={(e) => setSecondaryLanguage(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-xs p-2 focus:border-[#007acc] outline-none rounded-sm"
              >
                <option value="None">None</option>
                <option value="English">English</option>
                <option value="Simplified Chinese">Simplified Chinese</option>
                <option value="Traditional Chinese">Traditional Chinese</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="Japanese">Japanese</option>
                <option value="German">German</option>
                <option value="Russian">Russian</option>
                <option value="Dutch">Dutch</option>
                <option value="Korean">Korean</option>
                <option value="Italian">Italian</option>
                <option value="Portuguese">Portuguese</option>
              </select>
            </div>

           {/* Subtitle Handling */}
           <div className="space-y-2 pt-2">
              <label className="text-[10px] uppercase font-bold text-[#666666] tracking-wider">Subtitle Handling</label>
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
                          <div className="text-xs text-[#cccccc] group-hover:text-white">Replace all subtitles</div>
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
                          <div className="text-xs text-[#cccccc] group-hover:text-white">Update text only</div>
                          <div className="text-[10px] text-[#666]">Keep timing edits, refresh text</div>
                      </div>
                  </label>
              </div>
           </div>

           {/* Advanced Link */}
           <button 
             onClick={() => setShowAdvanced(true)}
             className="text-xs text-[#007acc] hover:underline flex items-center gap-1 mt-2"
           >
               <Settings className="w-3 h-3" />
               Custom Prompt Hints...
           </button>
           
           {error && <div className="text-red-400 text-xs px-2">{error}</div>}
        </div>

        <DialogFooter className="p-3 bg-[#1e1e1e] border-t border-[#333] flex justify-between items-center">
          
          {/* Split Button for Preview */}
          <div className="relative flex items-center">
              <button 
                onClick={handlePreview}
                className="px-3 py-1.5 text-xs bg-[#3e3e42] hover:bg-[#4e4e52] text-[#cccccc] rounded-l border-r border-[#2d2d2d] flex items-center gap-1"
                disabled={previewLoading || loadingModels || isProcessing}
              >
                  {previewLoading ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"/> : <Play className="w-3 h-3" />}
                  Preview...
              </button>
              <button 
                 className="px-1.5 py-1.5 bg-[#3e3e42] hover:bg-[#4e4e52] text-[#cccccc] rounded-r"
                 onClick={() => setShowDurationMenu(!showDurationMenu)}
                 disabled={previewLoading || loadingModels || isProcessing}
              >
                  <ChevronDown className="w-3 h-3" />
              </button>
              
              {showDurationMenu && (
                  <div className="absolute bottom-full left-0 mb-1 w-24 bg-[#252526] border border-[#454545] rounded shadow-lg overflow-hidden py-1 z-50">
                      {[2, 5, 10, 30, 60].map(d => (
                          <button
                            key={d}
                            onClick={() => { setPreviewDuration(d); setShowDurationMenu(false); }}
                            className="w-full text-left px-3 py-1 text-xs hover:bg-[#007acc] hover:text-white flex justify-between items-center group"
                          >
                              {d < 60 ? `${d}s` : '1m'}
                              {previewDuration === d && <Check className="w-3 h-3 text-[#007acc] group-hover:text-white" />}
                          </button>
                      ))}
                  </div>
              )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-[#cccccc] hover:bg-[#3e3e42] rounded"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              onClick={handleReprocess}
              disabled={isProcessing || loadingModels}
              className="px-3 py-1.5 text-xs bg-[#007acc] hover:bg-[#0062a3] text-white rounded disabled:opacity-50"
            >
              {isProcessing ? "Processing..." : "Reprocess"}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Advanced Options Sub-Dialog */}
      {showAdvanced && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
              <div className="bg-[#252526] border border-[#454545] rounded-lg shadow-xl w-[500px] flex flex-col animate-in fade-in zoom-in duration-200">
                  <div className="h-10 bg-[#333] flex items-center justify-between px-3 border-b border-[#454545]">
                      <span className="text-sm font-medium text-[#e1e1e1]">Advanced Options</span>
                      <button onClick={() => setShowAdvanced(false)} className="p-1 hover:bg-[#454545] rounded">
                          <X className="w-4 h-4 text-[#888]" />
                      </button>
                  </div>
                  <div className="p-4 bg-[#1e1e1e]">
                       <label className="block text-xs font-bold text-[#cccccc] mb-2">Custom Context / Hints</label>
                       <textarea
                         value={promptHints}
                         onChange={e => setPromptHints(e.target.value.slice(0, 1000))}
                         className="w-full h-32 bg-[#2d2d2d] text-[#cccccc] text-xs p-2 border border-[#3e3e42] rounded focus:border-[#007acc] outline-none resize-none placeholder:text-[#666]"
                         placeholder="Provide hints for the AI (speaker names, technical terms)..."
                       />
                       <div className="text-right text-[10px] text-[#666] mt-1">{promptHints.length} / 1000 characters</div>
                  </div>
                   <div className="p-3 border-t border-[#333] flex justify-end gap-2 bg-[#252526]">
                      <button onClick={() => setShowAdvanced(false)} className="px-3 py-1.5 text-xs bg-[#007acc] text-white rounded hover:bg-[#0062a3]">Apply</button>
                   </div>
              </div>
          </div>
      )}

      {/* Preview Dialog */}
      <PreviewDialog 
         isOpen={showPreviewDialog}
         onClose={() => setShowPreviewDialog(false)}
         onApply={() => { 
             // Apply just means we might want to keep settings? 
             // For now just close, user can click Reprocess
             setShowPreviewDialog(false); 
         }}
         isLoading={previewLoading}
         subtitles={previewSubtitles}
         videoPath={previewVideoPath}
         durationSeconds={previewDuration}
      />
    </>
  );
}
