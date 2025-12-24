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
    <div className="flex flex-col h-full bg-[#252526] text-[#cccccc]">
      <div className="h-8 border-b border-[#333333] flex justify-between items-center px-2 bg-[#2d2d2d]">
        <h3 className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Tracks ({subtitles.length})</h3>
        <button 
          onClick={addSubtitle}
          className="flex items-center text-[10px] bg-[#3e3e42] hover:bg-[#4e4e52] text-[#cccccc] px-2 py-0.5 rounded-sm border border-[#333333] transition-colors"
        >
          <Plus className="w-3 h-3 mr-1" /> Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-0 space-y-[1px] custom-scrollbar bg-[#1e1e1e]">
        {subtitles.map((sub, index) => {
          const isActive = currentTime >= sub.startTime && currentTime <= sub.endTime;
          return (
            <div 
              key={sub.id} 
              id={`sub-${sub.id}`}
              className={`p-2 transition-all group border-l-2 ${isActive ? "border-[#007acc] bg-[#2a2d2e]" : "border-transparent bg-[#252526] hover:bg-[#2a2d2e]"}`}
            >
              <div className="flex justify-between items-start mb-1.5">
                <div 
                  className={`flex items-center space-x-1.5 text-[10px] font-mono cursor-pointer transition-colors ${isActive ? 'text-[#007acc]' : 'text-[#666666] hover:text-[#999999]'}`}
                  onClick={() => onSeek(sub.startTime)}
                >
                  <Clock className="w-3 h-3" />
                  <span>{formatSRTTime(sub.startTime).split(',')[0]}</span>
                </div>
                
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
                   <button 
                      onClick={() => handleTranslate(index)}
                      className={`p-1 hover:bg-[#3e3e42] rounded-sm text-[#888888] hover:text-[#d7ba7d] transition-colors ${translatingId === sub.id ? 'animate-pulse text-[#d7ba7d]' : ''}`}
                      title="Auto-translate"
                      disabled={translatingId === sub.id}
                   >
                     <Wand2 className={`w-3 h-3 ${translatingId === sub.id ? 'animate-spin' : ''}`} />
                   </button>
                   <button 
                      onClick={() => deleteSubtitle(sub.id)}
                      className="p-1 hover:bg-[#3e3e42] rounded-sm text-[#888888] hover:text-[#f14c4c] transition-colors"
                   >
                     <Trash2 className="w-3 h-3" />
                   </button>
                </div>
              </div>

              <div className="space-y-1">
                <textarea
                  className="w-full text-xs bg-[#1e1e1e] border border-[#333333] rounded-sm p-1.5 text-[#cccccc] focus:border-[#007acc] outline-none resize-none transition-all placeholder:text-[#444444]"
                  rows={2}
                  value={sub.text}
                  onChange={(e) => handleTextChange(sub.id, 'text', e.target.value)}
                  onBlur={() => handleTranslate(index)}
                  placeholder="Primary Text..."
                />
                <textarea
                  className="w-full text-xs bg-[#1e1e1e] border border-[#333333] rounded-sm p-1.5 text-[#d7ba7d] focus:border-[#007acc] outline-none resize-none transition-all placeholder:text-[#444444]"
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
