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
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      <div className="p-2 mx-4 mt-4 bg-slate-950 rounded-lg p-1 flex space-x-1 border border-slate-800">
        <button
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'primary' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
          onClick={() => setActiveTab('primary')}
        >
          Primary
        </button>
        <button
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'secondary' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
          onClick={() => setActiveTab('secondary')}
        >
          Secondary
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        
        {/* Alignment */}
        <div className="space-y-3">
          <label className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Move className="w-3 h-3" /> <span>Position</span>
          </label>
          <div className="grid grid-cols-3 gap-1 w-32 h-24 mx-auto bg-slate-800 p-1 rounded-lg border border-slate-700">
              {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((align) => (
                  <button
                      key={align}
                      onClick={() => updateStyle('alignment', align as Alignment)}
                      className={`rounded hover:bg-slate-700 flex items-center justify-center text-xs font-mono transition-colors
                          ${config[activeTab].alignment === align ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500' : 'text-slate-500'}
                      `}
                  >
                      {align}
                  </button>
              ))}
          </div>
        </div>

        {/* Typography */}
        <div className="space-y-3">
          <label className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Type className="w-3 h-3" /> <span>Typography</span>
          </label>
          
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
               <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Size (px)</label>
                  <input 
                    type="number" 
                    value={config[activeTab].fontSize} 
                    onChange={(e) => updateStyle('fontSize', parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:border-indigo-500 outline-none"
                  />
               </div>
               <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Family</label>
                  <select 
                    value={config[activeTab].fontFamily} 
                    onChange={(e) => updateStyle('fontFamily', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:border-indigo-500 outline-none"
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
        <div className="space-y-3">
          <label className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Palette className="w-3 h-3" /> <span>Appearance</span>
          </label>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 block">Text Color</label>
              <div className="flex items-center space-x-2 bg-slate-950 border border-slate-700 rounded p-1">
                <input 
                  type="color" 
                  value={config[activeTab].color} 
                  onChange={(e) => updateStyle('color', e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                />
                <span className="text-xs font-mono text-slate-400">{config[activeTab].color}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 block">Background</label>
              <div className="flex items-center space-x-2 bg-slate-950 border border-slate-700 rounded p-1">
                <input 
                  type="color" 
                  value={config[activeTab].backgroundColor} 
                  onChange={(e) => updateStyle('backgroundColor', e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                />
                <span className="text-xs font-mono text-slate-400">Box</span>
              </div>
            </div>
          </div>
        </div>

        {/* Layout */}
        <div className="space-y-3">
          <label className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Layout className="w-3 h-3" /> <span>Margins</span>
          </label>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
               <label className="text-[10px] text-slate-500 mb-1 block">Vertical (px)</label>
               <input 
                  type="number" 
                  value={config[activeTab].marginV} 
                  onChange={(e) => updateStyle('marginV', parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:border-indigo-500 outline-none"
                />
            </div>
            <div>
               <label className="text-[10px] text-slate-500 mb-1 block">Horizontal (px)</label>
               <input 
                  type="number" 
                  value={config[activeTab].marginH} 
                  onChange={(e) => updateStyle('marginH', parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:border-indigo-500 outline-none"
                />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
