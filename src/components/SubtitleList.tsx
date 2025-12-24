"use client";

import React, { useState, useEffect } from "react";
import { SubtitleLine } from "@/types/subtitle";
import { Plus, Trash2, Wand2, Clock } from "lucide-react";
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
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0 z-10">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tracks ({subtitles.length})</h3>
        <button 
          onClick={addSubtitle}
          className="flex items-center text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-500 transition-colors"
        >
          <Plus className="w-3 h-3 mr-1" /> Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {subtitles.map((sub, index) => {
          const isActive = currentTime >= sub.startTime && currentTime <= sub.endTime;
          return (
            <div 
              key={sub.id} 
              id={`sub-${sub.id}`}
              className={`p-3 rounded-lg border transition-all group ${isActive ? "border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.1)]" : "border-slate-800 bg-slate-900 hover:border-slate-700"}`}
            >
              <div className="flex justify-between items-center mb-2">
                <div 
                  className={`flex items-center space-x-1.5 text-[10px] font-mono cursor-pointer transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-400'}`}
                  onClick={() => onSeek(sub.startTime)}
                >
                  <Clock className="w-3 h-3" />
                  <span>{formatSRTTime(sub.startTime).split(',')[0]}</span>
                </div>
                
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                      onClick={() => handleTranslate(index)}
                      className={`p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-purple-400 transition-colors ${translatingId === sub.id ? 'animate-pulse text-purple-500' : ''}`}
                      title="Auto-translate"
                      disabled={translatingId === sub.id}
                   >
                     <Wand2 className={`w-3 h-3 ${translatingId === sub.id ? 'animate-spin' : ''}`} />
                   </button>
                   <button 
                      onClick={() => deleteSubtitle(sub.id)}
                      className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
                   >
                     <Trash2 className="w-3 h-3" />
                   </button>
                </div>
              </div>

              <div className="space-y-2">
                <textarea
                  className="w-full text-sm bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none resize-none transition-all placeholder:text-slate-600"
                  rows={2}
                  value={sub.text}
                  onChange={(e) => handleTextChange(sub.id, 'text', e.target.value)}
                  onBlur={() => handleTranslate(index)}
                  placeholder="Primary Text..."
                />
                <textarea
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded p-2 text-indigo-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none resize-none transition-all placeholder:text-slate-600"
                  rows={2}
                  value={sub.secondaryText || ""}
                  onChange={(e) => handleTextChange(sub.id, 'secondaryText', e.target.value)}
                  placeholder="Translation..."
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}