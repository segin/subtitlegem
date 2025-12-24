"use client";

import React, { useState, useEffect } from "react";
import { SubtitleLine } from "@/types/subtitle";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { formatSRTTime } from "@/lib/srt-utils";

interface SubtitleListProps {
  subtitles: SubtitleLine[];
  onUpdate: (subtitles: SubtitleLine[]) => void;
  currentTime: number;
  onSeek: (time: number) => void;
}

export function SubtitleList({ subtitles, onUpdate, currentTime, onSeek }: SubtitleListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);

  // Scroll to active subtitle
  useEffect(() => {
    if (!editingId) {
      const active = subtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime);
      if (active) {
        document.getElementById(`sub-${active.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentTime, editingId, subtitles]);

  const handleTextChange = (id: string, field: 'text' | 'secondaryText', value: string) => {
    const updated = subtitles.map(s => s.id === id ? { ...s, [field]: value } : s);
    onUpdate(updated);
  };

  const handleTranslate = async (index: number) => {
    const sub = subtitles[index];
    if (!sub.text) return;

    setTranslatingId(sub.id);
    
    // Get extended context (2 lines before/after)
    const contextBefore = subtitles.slice(Math.max(0, index - 2), index).map(s => s.text).join('\n');
    const contextAfter = subtitles.slice(index + 1, index + 3).map(s => s.text).join('\n');

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sub.text,
          targetLanguage: "the requested secondary language", 
          contextBefore,
          contextAfter
        })
      });
      const data = await res.json();
      if (data.translation) {
        handleTextChange(sub.id, 'secondaryText', data.translation);
      }
    } catch (e) {
      console.error("Translation failed", e);
    } finally {
      setTranslatingId(null);
    }
  };

  const addSubtitle = () => {
    const lastSub = subtitles[subtitles.length - 1];
    const newStart = lastSub ? lastSub.endTime + 0.1 : 0;
    const newSub: SubtitleLine = {
      id: uuidv4(),
      startTime: newStart,
      endTime: newStart + 2,
      text: "New Subtitle",
      secondaryText: ""
    };
    onUpdate([...subtitles, newSub]);
    setEditingId(newSub.id);
  };

  const deleteSubtitle = (id: string) => {
    onUpdate(subtitles.filter(s => s.id !== id));
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-[600px]">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
        <h3 className="font-bold text-gray-700">Subtitle Editor</h3>
        <button 
          onClick={addSubtitle}
          className="flex items-center text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Line
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {subtitles.map((sub, index) => (
          <div 
            key={sub.id} 
            id={`sub-${sub.id}`}
            className={`p-3 rounded-lg border transition-all ${
              currentTime >= sub.startTime && currentTime <= sub.endTime 
                ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" 
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <div 
                className="text-xs font-mono text-gray-500 cursor-pointer hover:text-blue-600"
                onClick={() => onSeek(sub.startTime)}
              >
                {formatSRTTime(sub.startTime).split(',')[0]} - {formatSRTTime(sub.endTime).split(',')[0]}
              </div>
              <div className="flex items-center space-x-2">
                 <button 
                    onClick={() => handleTranslate(index)}
                    className="p-1 text-gray-400 hover:text-purple-600" 
                    title="Auto-translate"
                    disabled={translatingId === sub.id}
                 >
                   <Wand2 className={`w-3 h-3 ${translatingId === sub.id ? 'animate-spin' : ''}`} />
                 </button>
                 <button 
                    onClick={() => deleteSubtitle(sub.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                 >
                   <Trash2 className="w-3 h-3" />
                 </button>
              </div>
            </div>

            <div className="space-y-2">
              <textarea
                className="w-full text-sm p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                rows={2}
                value={sub.text}
                onChange={(e) => handleTextChange(sub.id, 'text', e.target.value)}
                onBlur={() => handleTranslate(index)} // Auto-translate on blur
                placeholder="Primary Text"
              />
              <textarea
                className="w-full text-sm p-2 border border-gray-300 rounded focus:ring-1 focus:ring-orange-400 outline-none resize-none bg-orange-50/50"
                rows={2}
                value={sub.secondaryText || ""}
                onChange={(e) => handleTextChange(sub.id, 'secondaryText', e.target.value)}
                placeholder="Secondary Text"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
