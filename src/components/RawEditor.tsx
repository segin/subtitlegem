"use client";

import React, { useState, useEffect } from "react";
import { SubtitleLine } from "@/types/subtitle";
import { parseSRT, stringifySRT } from "@/lib/srt-utils";
import { v4 as uuidv4 } from "uuid";

interface RawEditorProps {
  subtitles: SubtitleLine[];
  onSave: (subtitles: SubtitleLine[]) => void;
  onCancel: () => void;
}

export function RawEditor({ subtitles, onSave, onCancel }: RawEditorProps) {
  const [primarySRT, setPrimarySRT] = useState("");
  const [secondarySRT, setSecondarySRT] = useState("");

  useEffect(() => {
    setPrimarySRT(stringifySRT(subtitles, 'primary'));
    setSecondarySRT(stringifySRT(subtitles, 'secondary'));
  }, [subtitles]);

  const handleSave = () => {
    const parsedPrimary = parseSRT(primarySRT);
    const parsedSecondary = parseSRT(secondarySRT);

    const maxLength = Math.max(parsedPrimary.length, parsedSecondary.length);
    const newSubtitles: SubtitleLine[] = [];

    for (let i = 0; i < maxLength; i++) {
      const p = parsedPrimary[i];
      const s = parsedSecondary[i];
      
      if (p) {
        newSubtitles.push({
            id: uuidv4(),
            startTime: p.startTime!,
            endTime: p.endTime!,
            text: p.text || "",
            secondaryText: s ? s.text : ""
        });
      } else if (s) {
           newSubtitles.push({
            id: uuidv4(),
            startTime: s.startTime!,
            endTime: s.endTime!,
            text: "",
            secondaryText: s.text || ""
        });
      }
    }
    
    onSave(newSubtitles);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-8">
      <div className="bg-[#252526] border border-[#333333] shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col overflow-hidden rounded-sm">
        <header className="h-10 border-b border-[#333333] flex justify-between items-center px-4 bg-[#2d2d2d]">
          <h2 className="text-xs font-bold text-[#cccccc] uppercase tracking-wide">Raw SRT Editor</h2>
          <div className="space-x-2">
            <button 
              onClick={onCancel} 
              className="px-3 py-1 text-xs text-[#cccccc] hover:bg-[#3e3e42] rounded-sm transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              className="px-3 py-1 bg-[#007acc] text-white hover:bg-[#0062a3] text-xs font-semibold rounded-sm transition-colors"
            >
              Apply Changes
            </button>
          </div>
        </header>
        
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col border-r border-[#333333]">
             <div className="py-1 bg-[#1e1e1e] border-b border-[#333333] text-[10px] font-bold text-[#888888] text-center uppercase">Primary Track</div>
             <textarea 
                className="flex-1 p-4 font-mono text-xs bg-[#1e1e1e] text-[#cccccc] resize-none focus:outline-none custom-scrollbar"
                value={primarySRT}
                onChange={e => setPrimarySRT(e.target.value)}
                spellCheck={false}
             />
          </div>
          <div className="flex-1 flex flex-col">
             <div className="py-1 bg-[#1e1e1e] border-b border-[#333333] text-[10px] font-bold text-[#888888] text-center uppercase">Secondary Track</div>
             <textarea 
                className="flex-1 p-4 font-mono text-xs bg-[#1e1e1e] text-[#d7ba7d] resize-none focus:outline-none custom-scrollbar"
                value={secondarySRT}
                onChange={e => setSecondarySRT(e.target.value)}
                spellCheck={false}
             />
          </div>
        </div>
      </div>
    </div>
  );
}