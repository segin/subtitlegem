"use client";

import React from "react";
import { SubtitleConfig } from "@/types/subtitle";

interface ConfigProps {
  config: SubtitleConfig;
  onChange: (config: SubtitleConfig) => void;
}

export function ConfigPanel({ config, onChange }: ConfigProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onChange({
      ...config,
      [name]: name === 'fontSize' || name === 'marginW' || name === 'marginH' ? parseInt(value) : value
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
      <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Subtitle Styles</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Font Size</label>
          <input 
            type="number" name="fontSize" value={config.fontSize} onChange={handleChange}
            className="w-full p-2 border rounded text-sm"
          />
        </div>
        
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Alignment</label>
          <select 
            name="alignment" value={config.alignment} onChange={handleChange}
            className="w-full p-2 border rounded text-sm"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Text Color</label>
          <input 
            type="color" name="color" value={config.color} onChange={handleChange}
            className="w-full h-10 p-1 border rounded"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Background</label>
          <input 
            type="color" name="backgroundColor" value={config.backgroundColor} onChange={handleChange}
            className="w-full h-10 p-1 border rounded"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Margin H</label>
          <input 
            type="number" name="marginH" value={config.marginH} onChange={handleChange}
            className="w-full p-2 border rounded text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Margin W</label>
          <input 
            type="number" name="marginW" value={config.marginW} onChange={handleChange}
            className="w-full p-2 border rounded text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Font Family</label>
        <select 
          name="fontFamily" value={config.fontFamily} onChange={handleChange}
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
