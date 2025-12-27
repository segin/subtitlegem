"use client";

import React, { useState, useEffect, useRef } from "react";
import { SubtitleLine } from "@/types/subtitle";
import { Plus, Trash2, Wand2, Clock, Trash, FileText, Code, Settings, List, MonitorPlay, LogOut, Check, Move, Type, Palette, Layout, Upload, FileVideo, AlertCircle, Film, Cpu, Languages, Loader2 } from "lucide-react"; // Added Check for selection
import { v4 as uuidv4 } from "uuid";
import { formatSRTTime } from "@/lib/srt-utils";

interface SubtitleListProps {
  subtitles: SubtitleLine[];
  onUpdate: (subtitles: SubtitleLine[]) => void;
  currentTime: number;
  onSeek: (time: number) => void;
  secondaryLanguage: string; // Required for translation
}

export function SubtitleList({ subtitles, onUpdate, currentTime, onSeek, secondaryLanguage }: SubtitleListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
    setSelectedIds(prev => prev.filter(selectedId => selectedId !== id)); // Remove from selection if deleted
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const mergeSelectedSubtitles = () => {
    if (selectedIds.length !== 2) return;

    const sortedSelectedIds = [...selectedIds].sort((a, b) => {
      const indexA = subtitles.findIndex(s => s.id === a);
      const indexB = subtitles.findIndex(s => s.id === b);
      return indexA - indexB;
    });

    const index1 = subtitles.findIndex(s => s.id === sortedSelectedIds[0]);
    const index2 = subtitles.findIndex(s => s.id === sortedSelectedIds[1]);

    // Check for adjacency
    if (index1 === -1 || index2 === -1 || index2 !== index1 + 1) {
      alert("Please select two adjacent subtitles to merge.");
      setSelectedIds([]); // Clear selection if not adjacent
      return;
    }

    const sub1 = subtitles[index1];
    const sub2 = subtitles[index2];

    const mergedSubtitle: SubtitleLine = {
      id: uuidv4(), // New ID for the merged line
      startTime: sub1.startTime,
      endTime: sub2.endTime,
      text: `${sub1.text || ""}${sub1.text && sub2.text ? " " : ""}${sub2.text || ""}`.trim(),
      secondaryText: `${sub1.secondaryText || ""}${sub1.secondaryText && sub2.secondaryText ? " " : ""}${sub2.secondaryText || ""}`.trim(),
    };

    const newSubtitles = subtitles.filter(s => s.id !== sub1.id && s.id !== sub2.id);
    newSubtitles.splice(index1, 0, mergedSubtitle); // Insert merged subtitle at the first original index

    onUpdate(newSubtitles);
    setSelectedIds([]); // Clear selection after merging
  };

  const canMerge = selectedIds.length === 2 && 
                  Math.abs(subtitles.findIndex(s => s.id === selectedIds[0]) - subtitles.findIndex(s => s.id === selectedIds[1])) === 1;

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
                  <span>{formatSRTTime(sub.startTime).split(',')[0]}</span>
                </div>
                
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
                   <button 
                      onClick={() => toggleSelection(sub.id)}
                      className={`p-1.5 rounded-sm hover:bg-[#3e3e42] ${isSelected ? 'bg-[#007acc] text-white' : 'text-[#888888] hover:text-[#d7ba7d]'}`}
                      title={isSelected ? "Deselect" : "Select"}
                   >
                     {isSelected ? <Check className="w-3 h-3" /> : <Move className="w-3 h-3" />}
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