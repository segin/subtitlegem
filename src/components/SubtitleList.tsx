"use client";

import React, { useState, useEffect, useRef } from "react";
import { SubtitleLine } from "@/types/subtitle";
import { Plus, Trash2, Wand2, Clock, Trash, FileText, Code, Settings, List, MonitorPlay, LogOut, Check, Move, Type, Palette, Layout, Upload, FileVideo, AlertCircle, Film, Cpu, Languages, Loader2, Scissors } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { formatTimestamp } from "@/lib/time-utils";

interface SubtitleListProps {
  subtitles: SubtitleLine[];
  onUpdate: (subtitles: SubtitleLine[]) => void;
  currentTime: number;
  onSeek: (time: number) => void;
  secondaryLanguage: string;
  // Selection props (lifted to parent for cross-component sync)
  selectedIds: string[];
  onSelect: (id: string, shiftKey: boolean, ctrlKey: boolean) => void;
  onSplit: (id: string) => void;
}

export function SubtitleList({ subtitles, onUpdate, currentTime, onSeek, secondaryLanguage, selectedIds, onSelect, onSplit }: SubtitleListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);

  const handleTextChange = (id: string, field: 'text' | 'secondaryText', value: string) => {
    const updated = subtitles.map(s => s.id === id ? { ...s, [field]: value } : s);
    onUpdate(updated);
  };

  const handleTranslate = async (index: number) => {
    const sub = subtitles[index];
    if (!sub.text) return;

    setTranslatingId(sub.id);
    
    const contextBefore = subtitles.slice(Math.max(0, index - 7), index).map(s => s.text).join('\n');
    const contextAfter = subtitles.slice(index + 1, index + 8).map(s => s.text).join('\n');

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sub.text,
          targetLanguage: secondaryLanguage === "None" ? "" : secondaryLanguage, // Pass empty if None
          contextBefore,
          contextAfter
        })
      });
      const data = await res.json();
      if (data.translation) {
        handleTextChange(sub.id, 'secondaryText', data.translation);
      } else if (data.error) {
        console.error("Translation API error:", data.error);
        // Optionally show error to user
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

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    onSelect(id, e.shiftKey, e.ctrlKey || e.metaKey);
  };

  const mergeSelectedSubtitles = () => {
    if (selectedIds.length < 2) return;

    // Sort selected indices to check for continuity
    const selectedIndices = selectedIds
      .map(id => subtitles.findIndex(s => s.id === id))
      .sort((a, b) => a - b);

    // Check for continuity
    for (let i = 0; i < selectedIndices.length - 1; i++) {
      if (selectedIndices[i] === -1 || selectedIndices[i+1] !== selectedIndices[i] + 1) {
        alert("Please select sequential subtitles to merge.");
        return;
      }
    }

    const firstIndex = selectedIndices[0];
    const itemsToMerge = selectedIndices.map(idx => subtitles[idx]);
    
    const mergedSubtitle: SubtitleLine = {
      id: uuidv4(),
      startTime: itemsToMerge[0].startTime,
      endTime: itemsToMerge[itemsToMerge.length - 1].endTime,
      text: itemsToMerge.map(s => s.text || "").filter(t => t !== "").join(" "),
      secondaryText: itemsToMerge.map(s => s.secondaryText || "").filter(t => t !== "").join(" "),
      // Inherit overrides from first item if present
      primaryColor: itemsToMerge[0].primaryColor,
      secondaryColor: itemsToMerge[0].secondaryColor,
    };

    const newSubtitles = [...subtitles];
    newSubtitles.splice(firstIndex, selectedIndices.length, mergedSubtitle);

    onUpdate(newSubtitles);
    // Selection will be cleared by parent after merge
  };

  const getCanMerge = () => {
    if (selectedIds.length < 2) return false;
    const sortedIndices = selectedIds
      .map(id => subtitles.findIndex(s => s.id === id))
      .sort((a, b) => a - b);
    
    for (let i = 0; i < sortedIndices.length - 1; i++) {
        if (sortedIndices[i] === -1 || sortedIndices[i+1] !== sortedIndices[i] + 1) return false;
    }
    return true;
  };

  const canMerge = getCanMerge();

  return (
    <div className="flex flex-col h-full bg-[#252526] text-[#cccccc]">
      <div className="h-8 border-b border-[#333333] flex items-center justify-between px-2 bg-[#2d2d2d]">
        <h3 className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">Tracks ({subtitles.length})</h3>
        <div className="flex items-center space-x-2">
          {canMerge && (
            <button
              onClick={mergeSelectedSubtitles}
              className="flex items-center space-x-1.5 px-2 py-0.5 text-xs bg-[#3e3e42] hover:bg-[#4e4e52] text-[#007acc] rounded-sm border border-[#3e3e42] transition-colors"
            >
              <Plus className="w-3 h-3" /> Merge
            </button>
          )}
          <button 
            onClick={addSubtitle}
            className="flex items-center text-xs bg-[#007acc] text-white px-2 py-1 rounded-sm hover:bg-[#0062a3] transition-colors"
          >
            <Plus className="w-3 h-3 mr-1" /> Add
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-0 space-y-[1px] custom-scrollbar bg-[#1e1e1e]">
        {subtitles.map((sub, index) => {
          const isActive = currentTime >= sub.startTime && currentTime <= sub.endTime;
          const isSelected = selectedIds.includes(sub.id);
          
          return (
            <div 
              key={sub.id} 
              id={`sub-${sub.id}`}
              className={`p-2 transition-all group border-l-2 ${isActive 
                ? "border-[#007acc] bg-[#264f78] shadow-[0_0_15px_rgba(0,122,204,0.1)]" 
                : "border-transparent bg-[#252526] hover:bg-[#2d2d2d]"} flex flex-col space-y-1.5`}
            >
              <div className="flex justify-between items-start">
                <div 
                  className={`flex items-center space-x-1.5 text-[10px] font-mono cursor-pointer transition-colors ${isActive ? 'text-[#007acc]' : 'text-[#666666] hover:text-[#999999]'}`}
                  onClick={() => onSeek(sub.startTime)}
                >
                  <Clock className="w-3 h-3" />
                  <span>{formatTimestamp(sub.startTime).split(',')[0]}</span>
                </div>
                
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
                   <button 
                      onClick={(e) => toggleSelection(sub.id, e)}
                      className={`p-1.5 rounded-sm hover:bg-[#3e3e42] ${isSelected ? 'bg-[#007acc] text-white' : 'text-[#888888] hover:text-[#d7ba7d]'}`}
                      title={isSelected ? "Deselect (Shift+click for range)" : "Select (Shift+click for range)"}
                   >
                     {isSelected ? <Check className="w-3 h-3" /> : <Move className="w-3 h-3" />}
                   </button>
                   <button 
                      onClick={() => onSplit(sub.id)}
                      className="p-1.5 rounded-sm hover:bg-[#3e3e42] text-[#888888] hover:text-[#22c55e] transition-colors"
                      title="Split at midpoint"
                   >
                     <Scissors className="w-3 h-3" />
                   </button>
                   <button 
                      onClick={() => handleTranslate(index)}
                      className={`p-1.5 rounded-sm hover:bg-[#3e3e42] text-[#888888] hover:text-[#d7ba7d] transition-colors ${translatingId === sub.id ? 'animate-pulse text-[#d7ba7d]' : ''}`}
                      title="Auto-translate"
                      disabled={translatingId === sub.id}
                   >
                     <Wand2 className={`w-3 h-3 ${translatingId === sub.id ? 'animate-spin' : ''}`} />
                   </button>
                   <button 
                      onClick={() => deleteSubtitle(sub.id)}
                      className="p-1.5 rounded-sm hover:bg-[#3e3e42] text-[#888888] hover:text-red-400 transition-colors"
                   >
                     <Trash2 className="w-3 h-3" />
                   </button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="relative group/textarea">
                  <textarea
                    className="w-full text-xs bg-[#1e1e1e] border border-[#333333] rounded-sm p-1.5 text-[#cccccc] focus:border-[#007acc] outline-none resize-none transition-all placeholder:text-[#444444]"
                    style={sub.primaryColor ? { color: sub.primaryColor, borderColor: sub.primaryColor + '44' } : {}}
                    rows={2}
                    value={sub.text}
                    onChange={(e) => handleTextChange(sub.id, 'text', e.target.value)}
                    onBlur={() => handleTranslate(index)}
                    placeholder="Primary Text..."
                  />
                  <div className="absolute top-1 right-1 flex space-x-1 opacity-0 group-hover/textarea:opacity-100 transition-opacity">
                    <input 
                      type="color" 
                      value={sub.primaryColor || "#ffffff"} 
                      onChange={(e) => {
                        const updated = subtitles.map(s => s.id === sub.id ? { ...s, primaryColor: e.target.value } : s);
                        onUpdate(updated);
                      }}
                      className="w-4 h-4 p-0 border-0 bg-transparent cursor-pointer"
                      title="Override Primary Color"
                    />
                    {sub.primaryColor && (
                      <button 
                        onClick={() => {
                          const updated = subtitles.map(s => s.id === sub.id ? { ...s, primaryColor: undefined } : s);
                          onUpdate(updated);
                        }}
                        className="text-[9px] bg-[#333] hover:bg-[#444] px-1 rounded text-white"
                        title="Reset Color"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative group/textarea">
                  <textarea
                    className="w-full text-xs bg-[#1e1e1e] border border-[#333333] rounded-sm p-1.5 text-[#d7ba7d] focus:border-[#007acc] outline-none resize-none transition-all placeholder:text-[#444444]"
                    style={sub.secondaryColor ? { color: sub.secondaryColor, borderColor: sub.secondaryColor + '44' } : {}}
                    rows={2}
                    value={sub.secondaryText || ""}
                    onChange={(e) => handleTextChange(sub.id, 'secondaryText', e.target.value)}
                    placeholder="Translation..."
                  />
                  <div className="absolute top-1 right-1 flex space-x-1 opacity-0 group-hover/textarea:opacity-100 transition-opacity">
                    <input 
                      type="color" 
                      value={sub.secondaryColor || "#fbbf24"} 
                      onChange={(e) => {
                        const updated = subtitles.map(s => s.id === sub.id ? { ...s, secondaryColor: e.target.value } : s);
                        onUpdate(updated);
                      }}
                      className="w-4 h-4 p-0 border-0 bg-transparent cursor-pointer"
                      title="Override Secondary Color"
                    />
                    {sub.secondaryColor && (
                      <button 
                        onClick={() => {
                          const updated = subtitles.map(s => s.id === sub.id ? { ...s, secondaryColor: undefined } : s);
                          onUpdate(updated);
                        }}
                        className="text-[9px] bg-[#333] hover:bg-[#444] px-1 rounded text-white"
                        title="Reset Color"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}