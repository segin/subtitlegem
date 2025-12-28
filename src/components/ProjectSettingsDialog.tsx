"use client";

import React, { useState } from "react";
import { X, RefreshCw, Wand2, Globe, FileVideo } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface ProjectSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  config: {
    primaryLanguage?: string;
    secondaryLanguage?: string;
    geminiFileUri?: string | null;
    geminiFileExpiration?: string | null;
  };
  onUpdateConfig: (newConfig: any) => void;
  onReprocess: (language: string, model: string) => Promise<void>;
  onRetranslate: (language: string, model: string) => Promise<void>;
  onResetToOriginal?: () => void;
  canReset?: boolean;
}

export function ProjectSettingsDialog({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onReprocess,
  onRetranslate,
  onResetToOriginal,
  canReset = false,
}: ProjectSettingsDialogProps) {
  const [primaryLang, setPrimaryLang] = useState(config.primaryLanguage || "English");
  const [secondaryLang, setSecondaryLang] = useState(config.secondaryLanguage || "Secondary");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [availableModels, setAvailableModels] = useState<{name: string; displayName: string}[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
        setLoadingModels(true);
        fetch('/api/models')
            .then(res => res.json())
            .then(data => {
                if (data.models) setAvailableModels(data.models);
            })
            .catch(err => console.error("Failed to fetch models", err))
            .finally(() => setLoadingModels(false));
    }
  }, [isOpen]);

  const handleReprocess = async () => {
    if (!confirm("This will replace all current subtitles with a new transcription. Continue?")) return;
    try {
      setIsProcessing(true);
      setStatus("Reprocessing video...");
      await onReprocess(primaryLang, model);
      onUpdateConfig({ primaryLanguage: primaryLang });
      setStatus("Completed!");
      setTimeout(() => setStatus(null), 2000);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetranslate = async () => {
    if (!confirm("This will overwrite current secondary text. Continue?")) return;
    try {
      setIsProcessing(true);
      setStatus("Translating subtitles...");
      await onRetranslate(secondaryLang, model);
      onUpdateConfig({ secondaryLanguage: secondaryLang });
      setStatus("Completed!");
      setTimeout(() => setStatus(null), 2000);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const expirationDate = config.geminiFileExpiration ? new Date(config.geminiFileExpiration) : null;
  const isExpired = expirationDate ? expirationDate < new Date() : true;
  const canReprocess = config.geminiFileUri && !isExpired;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#1e1e1e] border border-[#333333] text-[#cccccc] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#e1e1e1] flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-[#3b82f6]" />
            Project Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* File Status */}
          <div className="bg-[#252526] p-4 rounded-md border border-[#333333]">
            <h3 className="text-xs font-semibold uppercase text-[#888888] mb-3 flex items-center gap-2">
              <FileVideo className="w-3 h-3" />
              Source File Status
            </h3>
            <div className="flex justify-between items-center text-sm">
                <span>Ref: {config.geminiFileUri ? "Available" : "Not Linked"}</span>
                {config.geminiFileUri && (
                    <span className={isExpired ? "text-red-400" : "text-green-400"}>
                        {isExpired ? "Expired" : "Active"} ({expirationDate?.toLocaleTimeString()})
                    </span>
                )}
            </div>
            {!canReprocess && (
                <p className="text-xs text-[#666666] mt-2">
                    * File must be re-uploaded to reprocess (Video context expired).
                </p>
            )}
           </div>

          {/* Primary Language */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#888888]">Primary Language (Transcription)</label>
            <div className="flex gap-2">
              <input 
                value={primaryLang}
                onChange={(e) => setPrimaryLang(e.target.value)}
                className="flex-1 bg-[#2d2d2d] border border-[#454545] rounded px-3 py-1.5 text-sm focus:border-[#007fd4] outline-none"
              />
              <button
                onClick={handleReprocess}
                disabled={!canReprocess || isProcessing}
                className="px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#454545] rounded text-xs flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isProcessing ? "animate-spin" : ""}`} />
                Reprocess
              </button>
            </div>
          </div>

          {/* Secondary Language */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#888888]">Secondary Language (Translation)</label>
            <div className="flex gap-2">
              <select
                value={secondaryLang}
                onChange={(e) => setSecondaryLang(e.target.value)}
                className="flex-1 bg-[#2d2d2d] border border-[#454545] rounded px-3 py-1.5 text-sm focus:border-[#007fd4] outline-none"
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
                 <option value="Ukrainian">Ukrainian</option>
                 <option value="Arabic">Arabic</option>
                 <option value="Korean">Korean</option>
                 <option value="Italian">Italian</option>
                 <option value="Portuguese">Portuguese</option>
              </select>
              <button
                onClick={handleRetranslate}
                disabled={isProcessing}
                className="px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#454545] rounded text-xs flex items-center gap-2 disabled:opacity-50"
              >
                <Globe className="w-3 h-3" />
                Retranslate
              </button>
            </div>
          </div>
          
          {status && (
            <div className="text-xs text-[#007fd4] font-medium text-center animate-pulse">
                {status}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {canReset && (
            <button 
              onClick={() => {
                if (confirm("Restore subtitles to their original state? All edits will be lost.")) {
                  onResetToOriginal?.();
                  onClose();
                }
              }}
              className="px-4 py-2 bg-[#4a4a4a] hover:bg-[#555555] text-white rounded text-sm"
            >
              Reset to Original
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 bg-[#007fd4] hover:bg-[#006cb5] text-white rounded text-sm">
            Done
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    )
}
