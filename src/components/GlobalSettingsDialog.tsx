"use client";

import React, { useState, useEffect } from "react";
import { GlobalSettings, DEFAULT_GLOBAL_SETTINGS } from "@/types/subtitle";
import { Settings, X, Type, Languages, Cpu, Sparkles, RotateCcw, Plus, Trash2, ChevronUp, ChevronDown, Palette } from "lucide-react";
import { TrackStyleEditor } from "./TrackStyleEditor";
import { normalizeToPx } from "@/lib/style-resolver";

interface GlobalSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GlobalSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabId;
}

export type TabId = 'styles' | 'languages' | 'encoding' | 'ai' | 'appearance';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'styles', label: 'Styles', icon: <Type className="w-3.5 h-3.5" /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className="w-3.5 h-3.5" /> },
  { id: 'languages', label: 'Languages', icon: <Languages className="w-3.5 h-3.5" /> },
  { id: 'encoding', label: 'Encoding', icon: <Cpu className="w-3.5 h-3.5" /> },
  { id: 'ai', label: 'AI Model', icon: <Sparkles className="w-3.5 h-3.5" /> },
];

const PRESETS = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'];

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian',
  'Japanese', 'Korean', 'Simplified Chinese', 'Traditional Chinese', 'Arabic',
  'Hindi', 'Thai', 'Vietnamese', 'Indonesian', 'Dutch', 'Polish', 'Turkish', 'None'
];

export function GlobalSettingsDialog({ isOpen, onClose, initialTab = 'styles' }: GlobalSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [stylesSubTab, setStylesSubTab] = useState<'primary' | 'secondary'>('primary');
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadModels();
      if (initialTab) setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const data = await res.json();
        setModels(data.models?.map((m: any) => m.name) || []);
      }
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        onClose();
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all settings to defaults?')) return;
    try {
      const res = await fetch('/api/settings', { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to reset settings:', err);
    }
  };
  
  // Preview Aspect Ratio State
  const [previewAspect, setPreviewAspect] = useState<'16:9' | '9:16'>('16:9');

  if (!isOpen) return null;

  // Get current style being edited
  const currentStyle = stylesSubTab === 'primary' ? settings.defaultPrimaryStyle : settings.defaultSecondaryStyle;
  const updateCurrentStyle = (updates: Partial<typeof currentStyle>) => {
    const key = stylesSubTab === 'primary' ? 'defaultPrimaryStyle' : 'defaultSecondaryStyle';
    setSettings({ ...settings, [key]: { ...currentStyle, ...updates } });
  };



  // Resolution details for "true to life" simulation
  const previewWidth = 320; 
  const previewHeight = previewAspect === '16:9' ? previewWidth * (9/16) : previewWidth * (16/9);
  
  const referenceHeight = previewAspect === '16:9' ? 1080 : 1920; 
  const scale = previewHeight / referenceHeight;

  // Helper to normalize style values for preview
  const getPreviewFontSize = (val: string | number) => {
    // 1. Normalize to 1080p pixels (e.g. "5%" -> 54px)
    const px = typeof val === 'string' && val.endsWith('%') 
      ? (parseFloat(val) / 100) * 1080 
      : (typeof val === 'number' ? val : parseFloat(String(val)) || 0);
      
    // 2. Scale to preview size
    return (px / 1080) * referenceHeight * scale;
  };

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
            <span className="text-sm font-medium text-[#e1e1e1]">Global Settings</span>
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
              onClick={() => setActiveTab(tab.id)}
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
        <div className="p-4 min-h-[280px]">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-[#007acc] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === 'styles' && (
                <div className="flex gap-6">
                  {/* Preview Panel */}
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
                        className="bg-[#1e1e1e] border border-[#3e3e42] rounded-sm relative overflow-hidden transition-all mx-auto"
                        style={{ width: previewWidth, height: previewHeight }}
                    >
                      {/* Simulated video background */}
                      <div className="absolute inset-0 bg-gradient-to-br from-[#333] to-[#222]" />
                      
                      {/* Reference Grid */}
                      <div className="absolute inset-0 opacity-10 pointer-events-none grid grid-cols-3 grid-rows-3">
                        {[...Array(9)].map((_, i) => (
                            <div key={i} className="border border-white/20"></div>
                        ))}
                      </div>

                      {/* Preview subtitles */}
                      <div 
                        className="absolute inset-0 pointer-events-none p-4"
                        style={{
                            paddingTop: currentStyle.alignment >= 7 ? (typeof currentStyle.marginV === 'string' ? currentStyle.marginV : `${(currentStyle.marginV / 1080) * 100}%`) : 0,
                            paddingBottom: currentStyle.alignment <= 3 ? (typeof currentStyle.marginV === 'string' ? currentStyle.marginV : `${(currentStyle.marginV / 1080) * 100}%`) : 0,
                            paddingLeft: typeof currentStyle.marginH === 'string' ? currentStyle.marginH : `${(currentStyle.marginH / 1920) * 100}%`,
                            paddingRight: typeof currentStyle.marginH === 'string' ? currentStyle.marginH : `${(currentStyle.marginH / 1920) * 100}%`,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: [1, 4, 7].includes(currentStyle.alignment) ? 'flex-start' : 
                                        [3, 6, 9].includes(currentStyle.alignment) ? 'flex-end' : 'center',
                            justifyContent: [7, 8, 9].includes(currentStyle.alignment) ? 'flex-start' : 
                                            [1, 2, 3].includes(currentStyle.alignment) ? 'flex-end' : 'center',
                        }}
                      >
                        <span 
                          style={{
                            fontFamily: currentStyle.fontFamily || 'Arial',
                            // Use correct scaling logic matching ASS renderer
                            fontSize: `${getPreviewFontSize(currentStyle.fontSize)}px`,
                            color: currentStyle.color,
                            backgroundColor: currentStyle.backgroundColor,
                            padding: '0.1em 0.3em',
                            textShadow: currentStyle.outlineWidth 
                              ? `0 0 ${getPreviewFontSize(currentStyle.outlineWidth || 0)}px ${currentStyle.outlineColor || '#000'}` 
                              : 'none',
                            boxShadow: 'none',
                            display: 'inline-block',
                            textAlign: [1, 4, 7].includes(currentStyle.alignment) ? 'left' : 
                                       [3, 6, 9].includes(currentStyle.alignment) ? 'right' : 'center', 
                            maxWidth: '100%',
                            wordBreak: 'break-word',
                            lineHeight: 1.5,
                          }}
                        >
                          {stylesSubTab === 'primary' ? 'Sample Text Line 1\nExample Line 2' : '样本文字第一行\n示例文字第二行'}
                        </span>
                      </div>
                    </div>
                    <p className="text-[9px] text-[#555] mt-1 text-center">Live Preview ({Math.round(referenceHeight)}p base)</p>
                  </div>

                  {/* Controls Panel */}
                  <div className="flex-1 space-y-4 overflow-y-auto max-h-[400px] pr-2">
                    {/* Style Mode Toggle */}
                    <div className="flex gap-1 bg-[#1e1e1e] p-1 rounded-sm">
                      <button
                        onClick={() => setSettings({ ...settings, subtitleStyle: 'split' })}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                          settings.subtitleStyle === 'split' 
                            ? 'bg-[#007acc] text-white' 
                            : 'text-[#888888] hover:text-[#cccccc] hover:bg-[#333333]'
                        }`}
                      >
                        Split
                      </button>
                      <button
                        onClick={() => setSettings({ ...settings, subtitleStyle: 'combined' })}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                          settings.subtitleStyle === 'combined' 
                            ? 'bg-[#007acc] text-white' 
                            : 'text-[#888888] hover:text-[#cccccc] hover:bg-[#333333]'
                        }`}
                      >
                        Combined
                      </button>
                    </div>

                    {/* Primary/Secondary Sub-tabs */}
                    <div className="flex gap-1 border-b border-[#333333]">
                      <button
                        onClick={() => setStylesSubTab('primary')}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          stylesSubTab === 'primary' 
                            ? 'text-[#e1e1e1] border-b-2 border-[#007acc]' 
                            : 'text-[#888888] hover:text-[#cccccc]'
                        }`}
                      >
                        Primary
                      </button>
                      <button
                        onClick={() => setStylesSubTab('secondary')}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                          stylesSubTab === 'secondary' 
                            ? 'text-[#e1e1e1] border-b-2 border-[#007acc]' 
                            : 'text-[#888888] hover:text-[#cccccc]'
                        }`}
                      >
                        Secondary
                      </button>
                    </div>

                    {/* Full Style Controls */}
                    <div className="space-y-3">
                        <TrackStyleEditor 
                            style={currentStyle} 
                            onChange={updateCurrentStyle}
                            mode="percentage"
                        />
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'appearance' && (
                <div className="space-y-4">
                  <div className="bg-[#1e1e1e] border border-[#333333] p-4 text-center rounded-sm">
                    <Palette className="w-8 h-8 text-[#555] mx-auto mb-2" />
                    <h4 className="text-sm font-medium text-[#e1e1e1] mb-1">Theme Settings</h4>
                    <p className="text-xs text-[#666666] mb-4">Dark Mode is currently the only supported theme.</p>
                    <div className="flex justify-center gap-2 pointer-events-none opacity-50">
                        <button className="px-3 py-1.5 bg-[#0e639c] text-white text-xs rounded-sm border border-[#3e3e42]">Dark Mode</button>
                        <button className="px-3 py-1.5 bg-[#e1e1e1] text-[#333] text-xs rounded-sm border border-[#ccc]">Light Mode</button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'languages' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase text-[#888888] font-bold mb-1 block">Default Primary Language</label>
                    <select
                      value={settings.defaultPrimaryLanguage}
                      onChange={(e) => setSettings({ ...settings, defaultPrimaryLanguage: e.target.value })}
                      className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-sm p-2 focus:border-[#007acc] outline-none"
                    >
                      {LANGUAGES.filter(l => l !== 'None').map((lang) => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-[#888888] font-bold mb-1 block">Default Secondary Language</label>
                    <select
                      value={settings.defaultSecondaryLanguage}
                      onChange={(e) => setSettings({ ...settings, defaultSecondaryLanguage: e.target.value })}
                      className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-sm p-2 focus:border-[#007acc] outline-none"
                    >
                      {LANGUAGES.map((lang) => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'encoding' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase text-[#888888] font-bold mb-1 block">Default Hardware Acceleration</label>
                    <select
                      value={settings.defaultHwaccel}
                      onChange={(e) => setSettings({ ...settings, defaultHwaccel: e.target.value })}
                      className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-sm p-2 focus:border-[#007acc] outline-none"
                    >
                      <option value="none">None (CPU)</option>
                      <option value="nvenc">NVIDIA (NVENC)</option>
                      <option value="amf">AMD (AMF)</option>
                      <option value="qsv">Intel (QuickSync)</option>
                      <option value="videotoolbox">Apple (VideoToolbox)</option>
                      <option value="vaapi">Linux (VAAPI)</option>
                    </select>
                    <p className="text-[10px] text-[#666666] mt-1">This will be checked against available encoders on startup</p>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-[#888888] font-bold mb-1 block">Default Preset</label>
                    <select
                      value={settings.defaultPreset}
                      onChange={(e) => setSettings({ ...settings, defaultPreset: e.target.value })}
                      className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-sm p-2 focus:border-[#007acc] outline-none"
                    >
                      {PRESETS.map((preset) => (
                        <option key={preset} value={preset}>{preset}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-[#888888] font-bold mb-1 block">Default CRF Quality ({settings.defaultCrf})</label>
                    <input
                      type="range"
                      min="0"
                      max="51"
                      value={settings.defaultCrf}
                      onChange={(e) => setSettings({ ...settings, defaultCrf: parseInt(e.target.value) })}
                      className="w-full accent-[#007acc]"
                    />
                    <div className="flex justify-between text-[9px] text-[#555555]">
                      <span>Lossless</span>
                      <span>Smaller</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'ai' && (
                <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-[#e1e1e1]">Safety Re-route Chain</h4>
                      <p className="text-[10px] text-[#666666]">
                        Ordered list of models to try. If a model fails due to a safety filter, the next one is tried.
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        const newChain = [...(settings.aiFallbackChain || [])];
                        newChain.push({
                          id: Math.random().toString(36).substr(2, 9),
                          provider: 'gemini',
                          modelName: 'gemini-1.5-flash',
                          enabled: true
                        });
                        setSettings({ ...settings, aiFallbackChain: newChain });
                      }}
                      className="flex items-center gap-1 px-2 py-1 bg-[#2d2d2d] border border-[#3e3e42] text-[10px] text-[#cccccc] hover:bg-[#3e3e42] rounded-sm transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add Model
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(settings.aiFallbackChain || []).map((model, index) => (
                      <div key={model.id} className="bg-[#1e1e1e] border border-[#333333] p-3 rounded-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#555] w-4">{index + 1}</span>
                            <select
                              value={model.provider}
                              onChange={(e) => {
                                const newChain = [...settings.aiFallbackChain];
                                newChain[index].provider = e.target.value as any;
                                setSettings({ ...settings, aiFallbackChain: newChain });
                              }}
                              className="bg-[#2d2d2d] border border-[#3e3e42] text-[#cccccc] text-[10px] px-1 py-0.5 rounded-sm outline-none"
                            >
                              <option value="gemini">Gemini</option>
                              <option value="deepseek">DeepSeek</option>
                              <option value="openai">OpenAI</option>
                              <option value="anthropic">Anthropic</option>
                              <option value="ollama">Ollama</option>
                              <option value="local">Local/Custom</option>
                            </select>
                            <input 
                              type="text"
                              value={model.modelName}
                              onChange={(e) => {
                                const newChain = [...settings.aiFallbackChain];
                                newChain[index].modelName = e.target.value;
                                setSettings({ ...settings, aiFallbackChain: newChain });
                              }}
                              placeholder="Model Name (e.g. gpt-4o)"
                              className="bg-[#2d2d2d] border border-[#3e3e42] text-[#cccccc] text-[10px] px-2 py-0.5 rounded-sm outline-none w-40"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                if (index === 0) return;
                                const newChain = [...settings.aiFallbackChain];
                                [newChain[index - 1], newChain[index]] = [newChain[index], newChain[index - 1]];
                                setSettings({ ...settings, aiFallbackChain: newChain });
                              }}
                              disabled={index === 0}
                              className="p-1 text-[#555] hover:text-[#888] disabled:opacity-30"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => {
                                if (index === settings.aiFallbackChain.length - 1) return;
                                const newChain = [...settings.aiFallbackChain];
                                [newChain[index], newChain[index + 1]] = [newChain[index + 1], newChain[index]];
                                setSettings({ ...settings, aiFallbackChain: newChain });
                              }}
                              disabled={index === settings.aiFallbackChain.length - 1}
                              className="p-1 text-[#555] hover:text-[#888] disabled:opacity-30"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => {
                                const newChain = settings.aiFallbackChain.filter(m => m.id !== model.id);
                                setSettings({ ...settings, aiFallbackChain: newChain });
                              }}
                              className="p-1 text-[#888] hover:text-[#f44336]"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {model.provider !== 'gemini' && model.provider !== 'ollama' && model.provider !== 'local' && (
                          <div className="flex gap-2">
                             <input 
                              type="password"
                              value={model.apiKey || ''}
                              onChange={(e) => {
                                const newChain = [...settings.aiFallbackChain];
                                newChain[index].apiKey = e.target.value;
                                setSettings({ ...settings, aiFallbackChain: newChain });
                              }}
                              placeholder="API Key (Optional if in .env)"
                              className="flex-1 bg-[#2d2d2d] border border-[#3e3e42] text-[#cccccc] text-[10px] px-2 py-1 rounded-sm outline-none"
                            />
                          </div>
                        )}

                        {(model.provider === 'ollama' || model.provider === 'local' || model.provider === 'openai') && (
                          <div className="flex gap-2">
                             <input 
                              type="text"
                              value={model.endpoint || ''}
                              onChange={(e) => {
                                const newChain = [...settings.aiFallbackChain];
                                newChain[index].endpoint = e.target.value;
                                setSettings({ ...settings, aiFallbackChain: newChain });
                              }}
                              placeholder="Endpoint URL (Optional)"
                              className="flex-1 bg-[#2d2d2d] border border-[#3e3e42] text-[#cccccc] text-[10px] px-2 py-1 rounded-sm outline-none"
                            />
                          </div>
                        )}
                      </div>
                    ))}

                    {(settings.aiFallbackChain || []).length === 0 && (
                      <div className="py-8 text-center border-2 border-dashed border-[#333] text-[#555] text-xs">
                        No fallbacks configured. Primary settings will be used.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-[#333333] bg-[#2d2d2d]">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-[#888888] hover:text-[#cccccc] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-[#cccccc] hover:bg-[#3e3e42] transition-colors border border-[#3e3e42]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-xs bg-[#0e639c] text-white hover:bg-[#1177bb] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
