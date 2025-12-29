"use client";

import React, { useState, useEffect } from "react";
import { GlobalSettings, DEFAULT_GLOBAL_SETTINGS } from "@/types/subtitle";
import { Settings, X, Type, Languages, Cpu, Sparkles, RotateCcw } from "lucide-react";
import { TrackStyleEditor } from "./TrackStyleEditor";

interface GlobalSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'styles' | 'languages' | 'encoding' | 'ai';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'styles', label: 'Styles', icon: <Type className="w-3.5 h-3.5" /> },
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

export function GlobalSettingsDialog({ isOpen, onClose }: GlobalSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>('styles');
  const [stylesSubTab, setStylesSubTab] = useState<'primary' | 'secondary'>('primary');
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadModels();
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  // Get current style being edited
  const currentStyle = stylesSubTab === 'primary' ? settings.defaultPrimaryStyle : settings.defaultSecondaryStyle;
  const updateCurrentStyle = (updates: Partial<typeof currentStyle>) => {
    const key = stylesSubTab === 'primary' ? 'defaultPrimaryStyle' : 'defaultSecondaryStyle';
    setSettings({ ...settings, [key]: { ...currentStyle, ...updates } });
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
                  <div className="w-64 shrink-0">
                    <div className="bg-[#1e1e1e] border border-[#3e3e42] rounded-sm aspect-video relative overflow-hidden">
                      {/* Simulated video background */}
                      <div className="absolute inset-0 bg-gradient-to-br from-[#333] to-[#222]" />
                      
                      {/* Preview subtitles */}
                      <div 
                        className="absolute left-1/2 -translate-x-1/2 text-center max-w-[90%]"
                        style={{
                          bottom: `${typeof currentStyle.marginV === 'number' ? currentStyle.marginV : parseFloat(String(currentStyle.marginV)) || 5}%`,
                          fontFamily: currentStyle.fontFamily,
                        }}
                      >
                        <span 
                          style={{
                            fontSize: `${(typeof currentStyle.fontSize === 'number' ? currentStyle.fontSize : parseFloat(String(currentStyle.fontSize)) || 5) * 5}px`,
                            color: currentStyle.color,
                            backgroundColor: currentStyle.backgroundColor,
                            padding: '2px 6px',
                            textShadow: currentStyle.outlineWidth 
                              ? `0 0 ${(typeof currentStyle.outlineWidth === 'number' ? currentStyle.outlineWidth : parseFloat(String(currentStyle.outlineWidth)) || 0.2) * 5}px ${currentStyle.outlineColor || '#000'}` 
                              : 'none',
                            display: 'inline-block',
                          }}
                        >
                          {stylesSubTab === 'primary' ? 'Sample Text' : '样本文字'}
                        </span>
                      </div>
                    </div>
                    <p className="text-[9px] text-[#555] mt-2 text-center">Live Preview</p>
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
                        />
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
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase text-[#888888] font-bold mb-1 block">Default Gemini Model</label>
                    <select
                      value={settings.defaultGeminiModel}
                      onChange={(e) => setSettings({ ...settings, defaultGeminiModel: e.target.value })}
                      className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-sm p-2 focus:border-[#007acc] outline-none"
                    >
                      {models.length > 0 ? (
                        models.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))
                      ) : (
                        <>
                          <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                          <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite</option>
                          <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                          <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                        </>
                      )}
                    </select>
                  </div>
                  <p className="text-xs text-[#666666]">
                    This model will be used by default for subtitle generation and translation.
                  </p>
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
