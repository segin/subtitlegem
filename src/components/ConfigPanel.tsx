"use client";

import React, { useState } from "react";
import { SubtitleConfig, TrackStyle, Alignment } from "@/types/subtitle";
import { AlignLeft, AlignCenter, AlignRight, Type, Palette, Layout, Move, Cpu, Settings, MonitorPlay } from "lucide-react";

interface ConfigProps {
  config: SubtitleConfig;
  onChange: (config: SubtitleConfig) => void;
}

export function ConfigPanel({ config, onChange }: ConfigProps) {
  const [activeTab, setActiveTab] = useState<'primary' | 'secondary' | 'encoding'>('primary');

  const updateStyle = (key: keyof TrackStyle, value: any) => {
    if (activeTab === 'encoding') return;
    
    onChange({
      ...config,
      [activeTab]: {
        ...config[activeTab],
        [key]: value
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#252526] text-[#cccccc]">
      <div className="p-2 bg-[#252526] flex space-x-1 border-b border-[#333333]">
        <button
          className={`flex-1 py-1 text-xs font-medium rounded-sm transition-all border ${activeTab === 'primary' ? 'bg-[#3e3e42] border-[#555555] text-white' : 'border-transparent text-[#888888] hover:text-[#cccccc] hover:bg-[#2d2d2d]'}`}
          onClick={() => setActiveTab('primary')}
        >
          Primary
        </button>
        <button
          className={`flex-1 py-1 text-xs font-medium rounded-sm transition-all border ${activeTab === 'secondary' ? 'bg-[#3e3e42] border-[#555555] text-white' : 'border-transparent text-[#888888] hover:text-[#cccccc] hover:bg-[#2d2d2d]'}`}
          onClick={() => setActiveTab('secondary')}
        >
          Secondary
        </button>
        <button
          className={`flex-1 py-1 text-xs font-medium rounded-sm transition-all border ${activeTab === 'encoding' ? 'bg-[#3e3e42] border-[#555555] text-white' : 'border-transparent text-[#888888] hover:text-[#cccccc] hover:bg-[#2d2d2d]'}`}
          onClick={() => setActiveTab('encoding')}
        >
          Encoding
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar bg-[#252526]">
        
        {activeTab !== 'encoding' ? (
          <>
            {/* Alignment */}
            <div className="space-y-2">
              <label className="flex items-center space-x-1.5 text-[10px] font-bold text-[#666666] uppercase tracking-wider">
                <Move className="w-3 h-3" /> <span>Position</span>
              </label>
              <div className="grid grid-cols-3 gap-0.5 w-24 h-24 mx-auto bg-[#333333] border border-[#333333]">
                  {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((align) => (
                      <button
                          key={align}
                          onClick={() => updateStyle('alignment', align as Alignment)}
                          className={`flex items-center justify-center text-[10px] font-mono transition-colors
                              ${(config[activeTab as 'primary' | 'secondary']).alignment === align ? 'bg-[#007acc] text-white' : 'bg-[#1e1e1e] text-[#666666] hover:bg-[#2d2d2d]'}
                          `}
                          type="button"
                      >
                          {align}
                      </button>
                  ))}
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-2">
              <label className="flex items-center space-x-1.5 text-[10px] font-bold text-[#666666] uppercase tracking-wider">
                <Type className="w-3 h-3" /> <span>Typography</span>
              </label>
              
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                   <div>
                      <label className="text-[10px] text-[#888888] mb-1 block">Size (%)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        min="0.5"
                        max="20"
                        value={(config[activeTab as 'primary' | 'secondary']).fontSize} 
                        onChange={(e) => updateStyle('fontSize', parseFloat(e.target.value) || 0)}
                        className="w-full bg-[#1e1e1e] border border-[#333333] rounded-sm p-1.5 text-xs text-[#cccccc] focus:border-[#007acc] outline-none"
                      />
                   </div>
                   <div>
                      <label className="text-[10px] text-[#888888] mb-1 block">Family</label>
                      <select 
                        value={(config[activeTab as 'primary' | 'secondary']).fontFamily} 
                        onChange={(e) => updateStyle('fontFamily', e.target.value)}
                        className="w-full bg-[#1e1e1e] border border-[#333333] rounded-sm p-1.5 text-xs text-[#cccccc] focus:border-[#007acc] outline-none"
                      >
                        <option value="Inter, sans-serif">Inter</option>
                        <option value="Arial, sans-serif">Arial</option>
                        <option value="Courier New, monospace">Mono</option>
                        <option value="Georgia, serif">Serif</option>
                      </select>
                   </div>
                </div>
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-2">
              <label className="flex items-center space-x-1.5 text-[10px] font-bold text-[#666666] uppercase tracking-wider">
                <Palette className="w-3 h-3" /> <span>Colors</span>
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-[#888888] block">Text</label>
                  <div className="flex items-center space-x-2 bg-[#1e1e1e] border border-[#333333] rounded-sm p-1">
                    <input 
                      type="color" 
                      value={(config[activeTab as 'primary' | 'secondary']).color} 
                      onChange={(e) => updateStyle('color', e.target.value)}
                      className="w-full h-4 bg-transparent border-none p-0 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-[#888888] block">Background</label>
                  <div className="flex items-center space-x-2 bg-[#1e1e1e] border border-[#333333] rounded-sm p-1">
                    <input 
                      type="color" 
                      value={(config[activeTab as 'primary' | 'secondary']).backgroundColor} 
                      onChange={(e) => updateStyle('backgroundColor', e.target.value)}
                      className="w-full h-4 bg-transparent border-none p-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Layout */}
            <div className="space-y-2">
              <label className="flex items-center space-x-1.5 text-[10px] font-bold text-[#666666] uppercase tracking-wider">
                <Layout className="w-3 h-3" /> <span>Margins</span>
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                   <label className="text-[10px] text-[#888888] mb-1 block">Vertical (%)</label>
                   <input 
                      type="number" 
                      step="0.1"
                      min="0"
                      max="50"
                      value={(config[activeTab as 'primary' | 'secondary']).marginV} 
                      onChange={(e) => updateStyle('marginV', parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#1e1e1e] border border-[#333333] rounded-sm p-1.5 text-xs text-[#cccccc] focus:border-[#007acc] outline-none"
                    />
                </div>
                <div>
                   <label className="text-[10px] text-[#888888] mb-1 block">Horizontal (%)</label>
                   <input 
                      type="number" 
                      step="0.1"
                      min="0"
                      max="50"
                      value={(config[activeTab as 'primary' | 'secondary']).marginH} 
                      onChange={(e) => updateStyle('marginH', parseFloat(e.target.value) || 0)}
                      className="w-full bg-[#1e1e1e] border border-[#333333] rounded-sm p-1.5 text-xs text-[#cccccc] focus:border-[#007acc] outline-none"
                    />
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Encoding Tab */
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="flex items-center space-x-1.5 text-[10px] font-bold text-[#666666] uppercase tracking-wider">
                <Cpu className="w-3 h-3" /> <span>Hardware Acceleration</span>
              </label>
              <select 
                value={config.ffmpeg.hwaccel} 
                onChange={(e) => onChange({...config, ffmpeg: {...config.ffmpeg, hwaccel: e.target.value as any}})}
                className="w-full bg-[#1e1e1e] border border-[#333333] rounded-sm p-1.5 text-xs text-[#cccccc] focus:border-[#007acc] outline-none"
              >
                <option value="none">CPU (libx264)</option>
                <option value="nvenc">NVIDIA (NVENC)</option>
                <option value="qsv">Intel (QuickSync)</option>
                <option value="videotoolbox">Apple (VideoToolbox)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center space-x-1.5 text-[10px] font-bold text-[#666666] uppercase tracking-wider">
                <Settings className="w-3 h-3" /> <span>Quality (CRF)</span>
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="range" 
                  min="0" 
                  max="51" 
                  value={config.ffmpeg.crf} 
                  onChange={(e) => onChange({...config, ffmpeg: {...config.ffmpeg, crf: parseInt(e.target.value)}})}
                  className="flex-1 accent-[#007acc]"
                />
                <span className="text-xs font-mono w-6">{config.ffmpeg.crf}</span>
              </div>
              <div className="flex justify-between text-[9px] text-[#555555]">
                <span>Better Quality (0)</span>
                <span>Smaller File (51)</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center space-x-1.5 text-[10px] font-bold text-[#666666] uppercase tracking-wider">
                <MonitorPlay className="w-3 h-3" /> <span>Preset</span>
              </label>
              <select 
                value={config.ffmpeg.preset} 
                onChange={(e) => onChange({...config, ffmpeg: {...config.ffmpeg, preset: e.target.value as any}})}
                className="w-full bg-[#1e1e1e] border border-[#333333] rounded-sm p-1.5 text-xs text-[#cccccc] focus:border-[#007acc] outline-none"
              >
                <option value="ultrafast">Ultrafast</option>
                <option value="superfast">Superfast</option>
                <option value="veryfast">Veryfast</option>
                <option value="faster">Faster</option>
                <option value="fast">Fast</option>
                <option value="medium">Medium</option>
                <option value="slow">Slow</option>
                <option value="slower">Slower</option>
                <option value="veryslow">Veryslow</option>
              </select>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}