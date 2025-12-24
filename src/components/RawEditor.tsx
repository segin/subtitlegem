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

    // Merge logic: simpler to just rebuild list. 
    // We assume primary is the source of truth for timing IDs, 
    // but this is tricky if they drift. 
    // For this simple editor, we'll try to match by index or just regenerate IDs.
    
    // Better approach: Take primary structure, map secondary text if times match approx?
    // Or just zip them.
    
    const maxLength = Math.max(parsedPrimary.length, parsedSecondary.length);
    const newSubtitles: SubtitleLine[] = [];

    for (let i = 0; i < maxLength; i++) {
      const p = parsedPrimary[i];
      const s = parsedSecondary[i];
      
      if (p) {
        newSubtitles.push({
            id: uuidv4(), // New IDs because syncing old ones is hard via raw text
            startTime: p.startTime!,
            endTime: p.endTime!,
            text: p.text || "",
            secondaryText: s ? s.text : "" // In parseSRT, 'text' holds the content
        });
      } else if (s) {
          // Secondary has extra lines? Add them as primary with empty text?
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col overflow-hidden">
        <header className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Raw SRT Editor</h2>
          <div className="space-x-2">
            <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded font-bold">Save Changes</button>
          </div>
        </header>
        
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col border-r border-gray-200">
             <div className="p-2 bg-gray-100 font-semibold text-center border-b">Primary (English)</div>
             <textarea 
                className="flex-1 p-4 font-mono text-sm resize-none focus:outline-none"
                value={primarySRT}
                onChange={e => setPrimarySRT(e.target.value)}
             />
          </div>
          <div className="flex-1 flex flex-col">
             <div className="p-2 bg-gray-100 font-semibold text-center border-b">Secondary</div>
             <textarea 
                className="flex-1 p-4 font-mono text-sm resize-none focus:outline-none"
                value={secondarySRT}
                onChange={e => setSecondarySRT(e.target.value)}
             />
          </div>
        </div>
      </div>
    </div>
  );
}
