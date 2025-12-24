"use client";

import React, { useState } from "react";
import { SubtitleConfig, TrackStyle, Alignment } from "@/types/subtitle";
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from "lucide-react";

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
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
      <div className="flex border-b border-gray-200 mb-4">
        <button
          className={`px-4 py-2 font-medium text-sm focus:outline-none ${activeTab === 'primary' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('primary')}
        >
          Primary (English)
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm focus:outline-none ${activeTab === 'secondary' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('secondary')}
        >
          Secondary
        </button>
      </div>

      <h3 className="text-lg font-bold text-gray-800 pb-2">
        {activeTab === 'primary' ? "Primary Style" : "Secondary Style"}
      </h3>
      
      {/* Alignment Grid */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Alignment</label>
        <div className="grid grid-cols-3 gap-1 w-24 h-24 mx-auto bg-gray-100 p-1 rounded">
            {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((align) => (
                <button
                    key={align}
                    onClick={() => updateStyle('alignment', align as Alignment)}
                    className={`rounded hover:bg-gray-200 flex items-center justify-center text-xs font-mono
                        ${config[activeTab].alignment === align ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm' : 'bg-white text-gray-600'}
                    `}
                >
                    {align}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Font Size</label>
          <input 
            type="number" 
            value={config[activeTab].fontSize} 
            onChange={(e) => updateStyle('fontSize', parseInt(e.target.value))}
            className="w-full p-2 border rounded text-sm"
          />
        </div>
        
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Text Color</label>
          <input 
            type="color" 
            value={config[activeTab].color} 
            onChange={(e) => updateStyle('color', e.target.value)}
            className="w-full h-10 p-1 border rounded"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Background</label>
          <input 
            type="color" 
            value={config[activeTab].backgroundColor} 
            onChange={(e) => updateStyle('backgroundColor', e.target.value)}
            className="w-full h-10 p-1 border rounded"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Margin Vert</label>
          <input 
            type="number" 
            value={config[activeTab].marginV} 
            onChange={(e) => updateStyle('marginV', parseInt(e.target.value))}
            className="w-full p-2 border rounded text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Margin Horiz</label>
          <input 
            type="number" 
            value={config[activeTab].marginH} 
            onChange={(e) => updateStyle('marginH', parseInt(e.target.value))}
            className="w-full p-2 border rounded text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Font Family</label>
        <select 
          value={config[activeTab].fontFamily} 
          onChange={(e) => updateStyle('fontFamily', e.target.value)}
          className="w-full p-2 border rounded text-sm"
        >
          <option value="Inter, sans-serif">Inter</option>
          <option value="Arial, sans-serif">Arial</option>
          <option value="Courier New, monospace">Courier New</option>
          <option value="Georgia, serif">Georgia</option>
        </select>
      </div>
    </div>
  );
}