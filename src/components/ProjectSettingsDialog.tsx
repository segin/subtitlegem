"use client";

import React, { useState, useEffect } from "react";
import { Settings, X, RefreshCw, Type, Languages } from "lucide-react";
import { TrackStyleEditor } from "./TrackStyleEditor";
import { SubtitleConfig, TrackStyle, DEFAULT_GLOBAL_SETTINGS } from "@/types/subtitle";
import { REFERENCE_WIDTH, REFERENCE_HEIGHT } from "@/types/constants";
import { resolveTrackStyle, normalizeToPx, getMarginPreviewStyle } from "@/lib/style-resolver";
import { getCachedModelResult } from "@/lib/model-cache";

interface ProjectSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  config: SubtitleConfig;
  onUpdateConfig: (newConfig: Partial<SubtitleConfig>) => void;
  onReprocess: (language: string, model: string) => Promise<void>;
  onRetranslate: (language: string, model: string) => Promise<void>;
  onResetToOriginal: () => void;
  canReset: boolean;
}

const TABS = [
    { id: 'general', label: 'General', icon: <Settings className="w-3.5 h-3.5" /> },
    { id: 'styles', label: 'Style Overrides', icon: <Type className="w-3.5 h-3.5" /> },
];

export function ProjectSettingsDialog({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onReprocess,
  onRetranslate,
  onResetToOriginal,
  canReset,
}: ProjectSettingsDialogProps) {
  // Config state
  const [primaryLang, setPrimaryLang] = useState(config.primaryLanguage || "English");
  const [secondaryLang, setSecondaryLang] = useState(config.secondaryLanguage || "Secondary");
  const [model, setModel] = useState(config.geminiModel || "gemini-2.0-flash");
  
  // Style overrides state
  const [primaryOverride, setPrimaryOverride] = useState<Partial<TrackStyle>>(config.primary || {});
  const [secondaryOverride, setSecondaryOverride] = useState<Partial<TrackStyle>>(config.secondary || {});
  
  const [activeTab, setActiveTab] = useState<'general' | 'styles'>('general');
  const [stylesSubTab, setStylesSubTab] = useState<'primary' | 'secondary'>('primary');

  // Preview Aspect Ratio State
  const [previewAspect, setPreviewAspect] = useState<'16:9' | '9:16'>('16:9');

  const [availableModels, setAvailableModels] = useState<{name: string; displayName: string}[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load models
  useEffect(() => {
    if (isOpen) {
      setLoadingModels(true);
      fetch('/api/models')
        .then(res => res.json())
        .then(data => {
            if (data.models) {
                // Filter out models known to fail
                const filtered = data.models.filter((m: any) => {
                    const cached = getCachedModelResult(m.name);
                    // Keep if unknown (null) or successful (true)
                    return cached !== false;
                });
                setAvailableModels(filtered);
            }
        })
        .catch(err => console.error("Failed to load models", err))
        .finally(() => setLoadingModels(false));
    }
  }, [isOpen]);

  // Sync state with props when opening or config changes
  useEffect(() => {
    if (isOpen) {
        setPrimaryOverride(config.primary || {});
        setSecondaryOverride(config.secondary || {});
        setModel(config.geminiModel || DEFAULT_GLOBAL_SETTINGS.defaultGeminiModel);
        setPrimaryLang(config.primaryLanguage || DEFAULT_GLOBAL_SETTINGS.defaultPrimaryLanguage);
        setSecondaryLang(config.secondaryLanguage || DEFAULT_GLOBAL_SETTINGS.defaultSecondaryLanguage);
    }
  }, [isOpen, config]);

  const handleUpdate = () => {
       onUpdateConfig({ 
           primaryLanguage: primaryLang, 
           secondaryLanguage: secondaryLang,
           geminiModel: model,
           primary: primaryOverride,
           secondary: secondaryOverride
       });
       onClose();
  };

  const handleReprocess = async () => {
    if (!primaryLang) return;
    if (!confirm(`This will discard current subtitles and regenerate them in ${primaryLang} using ${model}. Continue?`)) return;
    
    setIsProcessing(true);
    try {
      await onReprocess(primaryLang, model);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Reprocessing failed: " + err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetranslate = async () => {
    if (!secondaryLang) return;
    if (!confirm(`This will translate current subtitles to ${secondaryLang} using ${model}. Continue?`)) return;

    setIsProcessing(true);
    try {
      await onRetranslate(secondaryLang, model);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Translation failed: " + err);
    } finally {
      setIsProcessing(false);
    }
  };

  const updateStyleOverride = (updates: Partial<TrackStyle>) => {
      if (stylesSubTab === 'primary') {
         setPrimaryOverride(prev => ({ ...prev, ...updates }));
      } else {
         setSecondaryOverride(prev => ({ ...prev, ...updates }));
      }
  };

  const resetCurrentOverride = () => {
      if (confirm('Clear all project-specific overrides for this style? It will revert to Global Defaults.')) {
        if (stylesSubTab === 'primary') {
            setPrimaryOverride({});
        } else {
            setSecondaryOverride({});
        }
      }
  };

  if (!isOpen) return null;

  // Resolve current effective style for preview
  const currentOverride = stylesSubTab === 'primary' ? primaryOverride : secondaryOverride;
  const baseStyle = stylesSubTab === 'primary' ? DEFAULT_GLOBAL_SETTINGS.defaultPrimaryStyle : DEFAULT_GLOBAL_SETTINGS.defaultSecondaryStyle;
  const resolvedStyle = resolveTrackStyle(baseStyle, currentOverride);

  const canReprocess = true; // Simplified

  // Resolution details for "true to life" simulation
  const previewWidth = 400; 
  const previewHeight = previewAspect === '16:9' ? previewWidth * (9/16) : previewWidth * (16/9);
  
  const referenceHeight = previewAspect === '16:9' ? REFERENCE_HEIGHT : REFERENCE_WIDTH; 
  const scale = previewHeight / referenceHeight;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-[#252526] border border-[#3e3e42] shadow-2xl w-full max-w-4xl rounded-sm max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-10 bg-[#333333] flex items-center justify-between px-3 border-b border-[#454545] shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#888888]" />
            <span className="text-sm font-medium text-[#e1e1e1]">Project Settings</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#454545] rounded transition-colors">
            <X className="w-4 h-4 text-[#888888]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#333333] bg-[#2d2d2d]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 px-3 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors
                ${activeTab === tab.id 
                  ? 'bg-[#252526] text-[#e1e1e1] border-b-2 border-[#007acc]' 
                  : 'text-[#888888] hover:text-[#cccccc] hover:bg-[#333333]'
                }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[600px] min-h-[300px]">
           {activeTab === 'general' && (
               <div className="space-y-6 max-w-md mx-auto">
                    {/* Primary Language */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-[#888888]">Primary Language (Transcription)</label>
                        <div className="flex gap-2">
                        <input 
                            value={primaryLang}
                            onChange={(e) => setPrimaryLang(e.target.value)}
                            className="flex-1 bg-[#1e1e1e] border border-[#3e3e42] rounded px-3 py-1.5 text-sm focus:border-[#007fd4] outline-none text-[#ccc]"
                        />
                        <button
                            onClick={handleReprocess}
                            disabled={!canReprocess || isProcessing}
                            className="px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#454545] rounded text-xs flex items-center gap-2 disabled:opacity-50 text-[#ccc]"
                        >
                            <RefreshCw className={`w-3 h-3 ${isProcessing ? "animate-spin" : ""}`} />
                            Reprocess
                        </button>
                        </div>
                    </div>

                    {/* Model Selection */}
                    <div className="space-y-2">
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
                                <option value="gemini-2.0-flash">Gemini 2.0 Flash (Default)</option>
                            )}
                        </select>
                        <p className="text-[10px] text-[#666]">
                            Overrides global default model for this project.
                        </p>
                    </div>

                    {/* Secondary Language */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-[#888888]">Secondary Language (Translation)</label>
                        <div className="flex gap-2">
                        <input 
                            value={secondaryLang}
                            onChange={(e) => setSecondaryLang(e.target.value)}
                            className="flex-1 bg-[#1e1e1e] border border-[#3e3e42] rounded px-3 py-1.5 text-sm focus:border-[#007fd4] outline-none text-[#ccc]"
                        />
                        <button
                            onClick={handleRetranslate}
                            disabled={!canReprocess || isProcessing}
                            className="px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-[#454545] rounded text-xs flex items-center gap-2 disabled:opacity-50 text-[#ccc]"
                        >
                            <Languages className="w-3 h-3" />
                            Translate
                        </button>
                        </div>
                    </div>
               </div>
           )}

           {activeTab === 'styles' && (
               <div className="flex gap-6 h-full">
                    {/* Preview (Resolved) */}
                    <div className="space-y-2">
                        <div className="flex justify-center gap-2 mb-2">
                             <button 
                               onClick={() => setPreviewAspect('16:9')}
                               className={`px-2 py-1 text-[10px] rounded border ${previewAspect === '16:9' ? 'bg-[#007acc] border-[#007acc] text-white' : 'border-[#333] text-[#888]'}`}
                             >
                               16:9
                             </button>
                             <button 
                               onClick={() => setPreviewAspect('9:16')}
                               className={`px-2 py-1 text-[10px] rounded border ${previewAspect === '9:16' ? 'bg-[#007acc] border-[#007acc] text-white' : 'border-[#333] text-[#888]'}`}
                             >
                               9:16
                             </button>
                        </div>
                        
                        <div 
                            className="bg-[#1e1e1e] border border-[#3e3e42] rounded-sm relative overflow-hidden shrink-0 mx-auto transition-all"
                            style={{ width: previewWidth, height: previewHeight }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-[#333] to-[#222]" />
                            
                            {/* Reference Grid */}
                            <div className="absolute inset-0 opacity-10 pointer-events-none grid grid-cols-3 grid-rows-3">
                                {[...Array(9)].map((_, i) => (
                                    <div key={i} className="border border-white/20"></div>
                                ))}
                            </div>
                            
                            {/* Subtitle Render */}
                            <div 
                                className="absolute inset-0 pointer-events-none p-4"
                                style={getMarginPreviewStyle(resolvedStyle.marginV, resolvedStyle.marginH, resolvedStyle.alignment)}
                            >
                                <span 
                                    style={{
                                    fontFamily: resolvedStyle.fontFamily || 'Arial',
                                    // Scale 1080p ref pixels to preview height
                                    fontSize: `${(normalizeToPx(resolvedStyle.fontSize, REFERENCE_HEIGHT) / REFERENCE_HEIGHT) * referenceHeight * scale}px`, 
                                    color: resolvedStyle.color || '#FFF',
                                    backgroundColor: resolvedStyle.backgroundColor || 'transparent',
                                    padding: '0.1em 0.3em',
                                    textShadow: resolvedStyle.outlineWidth 
                                        ? `0 0 ${(normalizeToPx(resolvedStyle.outlineWidth, REFERENCE_HEIGHT) / REFERENCE_HEIGHT * referenceHeight * scale)}px ${resolvedStyle.outlineColor || '#000'}` 
                                        : 'none',
                                    boxShadow: 'none',
                                    display: 'inline-block',
                                    lineHeight: 1.5,
                                    textAlign: [1, 4, 7].includes(resolvedStyle.alignment) ? 'left' : 
                                               [3, 6, 9].includes(resolvedStyle.alignment) ? 'right' : 'center', 
                                    whiteSpace: 'pre-wrap', 
                                    maxWidth: '100%',
                                    wordBreak: 'break-word',
                                    }}
                                >
                                    {stylesSubTab === 'primary' ? 'This is a sample subtitle line.\nIt demonstrates the style.' : '这是一行示例子幕。\n它展示了样式效果。'}
                                </span>
                            </div>
                        </div>
                        <p className="text-[10px] text-[#555] text-center">
                            Preview ({previewAspect}) • {Math.round(referenceHeight)}p base
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="flex-1 space-y-4 min-w-[300px]">
                        <div className="flex justify-between items-center bg-[#1e1e1e] p-1 rounded-sm border border-[#3e3e42]">
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setStylesSubTab('primary')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                                    stylesSubTab === 'primary' 
                                        ? 'bg-[#333333] text-[#e1e1e1] shadow-sm' 
                                        : 'text-[#888888] hover:text-[#cccccc]'
                                    }`}
                                >
                                    Primary Style
                                </button>
                                <button
                                    onClick={() => setStylesSubTab('secondary')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                                    stylesSubTab === 'secondary' 
                                        ? 'bg-[#333333] text-[#e1e1e1] shadow-sm' 
                                        : 'text-[#888888] hover:text-[#cccccc]'
                                    }`}
                                >
                                    Secondary Style
                                </button>
                            </div>
                            
                            <span className="text-[10px] text-[#555] px-2">
                                {Object.keys(currentOverride).length} overrides active
                            </span>
                        </div>

                        <div className="bg-[#1e1e1e] border border-[#3e3e42] rounded-sm p-4 overflow-y-auto max-h-[400px]">
                            <TrackStyleEditor
                                style={currentOverride}
                                onChange={updateStyleOverride}
                                onReset={Object.keys(currentOverride).length > 0 ? resetCurrentOverride : undefined}
                            />
                        </div>
                    </div>
               </div>
           )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-3 border-t border-[#333333] bg-[#2d2d2d] shrink-0">
             <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-[#cccccc] hover:bg-[#3e3e42] transition-colors border border-[#3e3e42]"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              className="px-4 py-1.5 text-xs bg-[#0e639c] text-white hover:bg-[#1177bb] transition-colors"
            >
              Save Project Settings
            </button>
        </div>
      </div>
    </div>
  );
}
