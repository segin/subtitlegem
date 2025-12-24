"use client";

import React, { useState } from "react";
import { SubtitleConfig, TrackStyle, Alignment } from "@/types/subtitle";
import { AlignLeft, AlignCenter, AlignRight, Type, Palette, Layout, Move } from "lucide-react";

interface ConfigProps {
  config: SubtitleConfig;
  onChange: (config: SubtitleConfig) => void;
}

export function ConfigPanel({ config, onChange }: ConfigProps) {
  const [activeTab, setActiveTab] = useState<'primary' | 'secondary'>('primary');

  const updateStyle = (key: keyof TrackStyle, value: any) => {
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
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar bg-[#252526]">
        
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
                          ${config[activeTab].alignment === align ? 'bg-[#007acc] text-white' : 'bg-[#1e1e1e] text-[#666666] hover:bg-[#2d2d2d]'}
                      `}
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
                  <label className="text-[10px] text-[#888888] mb-1 block">Size (px)</label>
                  <input 
                    type="number" 
                    value={config[activeTab].fontSize} 
                    onChange={(e) => updateStyle('fontSize', parseInt(e.target.value))}
                    className="w-full bg-[#1e1e1e] border border-[#333333] rounded-sm p-1.5 text-xs text-[#cccccc] focus:border-[#007acc] outline-none"
                  />
               </div>
               <div>
                  <label className="text-[10px] text-[#888888] mb-1 block">Family</label>
                  <select 
                    value={config[activeTab].fontFamily} 
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
                  value={config[activeTab].color} 
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
                  value={config[activeTab].backgroundColor} 
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
               <label className="text-[10px] text-[#888888] mb-1 block">Vertical</label>
               <input 
                  type="number" 
                  value={config[activeTab].marginV} 
                  onChange={(e) => updateStyle('marginV', parseInt(e.target.value))}
                  className="w-full bg-[#1e1e1e] border border-[#333333] rounded-sm p-1.5 text-xs text-[#cccccc] focus:border-[#007acc] outline-none"
                />
            </div>
            <div>
               <label className="text-[10px] text-[#888888] mb-1 block">Horizontal</label>
               <input 
                  type="number" 
                  value={config[activeTab].marginH} 
                  onChange={(e) => updateStyle('marginH', parseInt(e.target.value))}
                  className="w-full bg-[#1e1e1e] border border-[#333333] rounded-sm p-1.5 text-xs text-[#cccccc] focus:border-[#007acc] outline-none"
                />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}