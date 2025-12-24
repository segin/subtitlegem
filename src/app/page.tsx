"use client";

import React, { useState } from "react";
import { VideoUpload } from "@/components/VideoUpload";
import { SubtitleTimeline } from "@/components/SubtitleTimeline";
import { VideoPreview } from "@/components/VideoPreview";
import { ConfigPanel } from "@/components/ConfigPanel";
import { SubtitleLine, SubtitleConfig } from "@/types/subtitle";
import { v4 as uuidv4 } from "uuid";
import { Download, Sparkles } from "lucide-react";

import { parseSRTTime } from "@/lib/utils";

export default function Home() {
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [config, setConfig] = useState<SubtitleConfig>({
    alignment: 'center',
    fontSize: 24,
    color: '#ffffff',
    fontFamily: 'Inter, sans-serif',
    marginW: 20,
    marginH: 40,
    backgroundColor: 'rgba(0,0,0,0.5)'
  });

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
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <Sparkles className="w-8 h-8 text-blue-600" />
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">SubtitleGem</h1>
          </div>
          <p className="text-lg text-gray-600">Generate and refine professional subtitles with Gemini AI</p>
        </header>

        {!videoUrl ? (
          <VideoUpload onUploadComplete={handleUploadComplete} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
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
            
            <div className="space-y-6">
              <ConfigPanel config={config} onChange={setConfig} />
              <button 
                className="w-full flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all"
                onClick={() => alert("Exporting feature would call burnSubtitles API...")}
              >
                <Download className="w-5 h-5" />
                <span>Burn & Export Video</span>
              </button>
              
              <button 
                className="w-full py-2 text-gray-500 hover:text-gray-700 font-medium transition-colors"
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
    </main>
  );
}