"use client";

import React, { useState, useEffect } from "react";
import { GlobalSettings, DEFAULT_GLOBAL_SETTINGS } from "@/types/subtitle";
import { Settings, X, Type, Languages, Cpu, Sparkles, RotateCcw } from "lucide-react";

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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-[#252526] border border-[#3e3e42] shadow-2xl w-full max-w-lg rounded-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-10 bg-[#333333] flex items-center justify-between px-3 border-b border-[#454545]">
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
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase text-[#888888] font-bold mb-1 block">Primary Font Size (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={settings.defaultPrimaryFontSize}
                        onChange={(e) => setSettings({ ...settings, defaultPrimaryFontSize: parseFloat(e.target.value) || 2.22 })}
                        className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-sm p-2 focus:border-[#007acc] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-[#888888] font-bold mb-1 block">Secondary Font Size (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={settings.defaultSecondaryFontSize}
                        onChange={(e) => setSettings({ ...settings, defaultSecondaryFontSize: parseFloat(e.target.value) || 1.85 })}
                        className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-sm p-2 focus:border-[#007acc] outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase text-[#888888] font-bold mb-1 block">Vertical Margin (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.defaultMarginV}
                        onChange={(e) => setSettings({ ...settings, defaultMarginV: parseFloat(e.target.value) || 2.78 })}
                        className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-sm p-2 focus:border-[#007acc] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-[#888888] font-bold mb-1 block">Horizontal Margin (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.defaultMarginH}
                        onChange={(e) => setSettings({ ...settings, defaultMarginH: parseFloat(e.target.value) || 1.04 })}
                        className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-sm p-2 focus:border-[#007acc] outline-none"
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
