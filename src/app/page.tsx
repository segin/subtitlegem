"use client";

import React, { useState } from "react";
import { VideoUpload } from "@/components/VideoUpload";
import { SubtitleTimeline } from "@/components/SubtitleTimeline";
import { VideoPreview } from "@/components/VideoPreview";
import { ConfigPanel } from "@/components/ConfigPanel";
import { SubtitleList } from "@/components/SubtitleList";
import { RawEditor } from "@/components/RawEditor";
import { SubtitleLine, SubtitleConfig, DEFAULT_CONFIG } from "@/types/subtitle";
import { parseSRTTime } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { Download, Sparkles, FileText, Code } from "lucide-react";

export default function Home() {
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [config, setConfig] = useState<SubtitleConfig>(DEFAULT_CONFIG);
  const [showRawEditor, setShowRawEditor] = useState(false);

  const handleUploadComplete = (rawSubtitles: any[], url: string) => {
    // Map raw subtitles to our SubtitleLine format
    const mapped: SubtitleLine[] = rawSubtitles.map(s => ({
      id: uuidv4(),
      startTime: parseSRTTime(s.startTime),
      endTime: parseSRTTime(s.endTime),
      text: s.text,
      secondaryText: s.secondaryText
    }));
    setSubtitles(mapped);
    setVideoUrl(url);
  };

  return (
    <main className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1600px] mx-auto space-y-8">
        <header className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <Sparkles className="w-8 h-8 text-blue-600" />
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">SubtitleGem</h1>
          </div>
          <p className="text-lg text-gray-600">Generate, edit, and refine professional subtitles with Gemini AI</p>
        </header>

        {!videoUrl ? (
          <VideoUpload onUploadComplete={handleUploadComplete} />
        ) : (
          <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
            {/* Left Column: Preview & Timeline */}
            <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
               <VideoPreview 
                  videoUrl={videoUrl} 
                  subtitles={subtitles} 
                  config={config} 
                  currentTime={currentTime}
                  onTimeUpdate={setCurrentTime}
                  onDurationChange={setDuration}
                />
                <SubtitleTimeline 
                  subtitles={subtitles} 
                  duration={duration} 
                  onUpdate={setSubtitles}
                  currentTime={currentTime}
                  onSeek={setCurrentTime}
                />
            </div>
            
            {/* Right Column: Editors & Config */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-hidden">
               {/* Controls */}
               <div className="flex gap-2">
                 <button 
                    onClick={() => setShowRawEditor(true)}
                    className="flex-1 flex items-center justify-center space-x-2 bg-gray-800 hover:bg-gray-900 text-white py-2 px-4 rounded-lg transition-all text-sm font-semibold"
                 >
                    <Code className="w-4 h-4" /> <span>Raw Editor</span>
                 </button>
                 <button 
                  className="flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg shadow transition-all text-sm font-semibold"
                  onClick={() => alert("Export feature pending...")}
                >
                  <Download className="w-4 h-4" />
                  <span>Export Video</span>
                </button>
               </div>

               {/* Tabs or stacked panels */}
               <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2">
                  <ConfigPanel config={config} onChange={setConfig} />
                  <SubtitleList 
                    subtitles={subtitles} 
                    onUpdate={setSubtitles} 
                    currentTime={currentTime}
                    onSeek={setCurrentTime}
                  />
               </div>
               
               <button 
                  className="w-full py-2 text-gray-500 hover:text-gray-700 font-medium transition-colors text-sm"
                  onClick={() => {
                    setVideoUrl(null);
                    setSubtitles([]);
                  }}
                >
                  Start Over
                </button>
            </div>
          </div>
        )}
      </div>

      {showRawEditor && (
        <RawEditor 
          subtitles={subtitles} 
          onSave={(newSubs) => {
            setSubtitles(newSubs);
            setShowRawEditor(false);
          }} 
          onCancel={() => setShowRawEditor(false)} 
        />
      )}
    </main>
  );
}
