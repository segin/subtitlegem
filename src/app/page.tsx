"use client";

import React, { useState } from "react";
import { VideoUpload } from "@/components/VideoUpload";
import { SubtitleTimeline } from "@/components/SubtitleTimeline";
import { VideoPreview } from "@/components/VideoPreview";
import { ConfigPanel } from "@/components/ConfigPanel";
import { SubtitleList } from "@/components/SubtitleList";
import { RawEditor } from "@/components/RawEditor";
import { SubtitleLine, SubtitleConfig, DEFAULT_CONFIG } from "@/types/subtitle";
import { parseSRTTime, stringifySRT } from "@/lib/srt-utils";
import { v4 as uuidv4 } from "uuid";
import { Download, Sparkles, Code, Settings, List, MonitorPlay, LogOut } from "lucide-react";

export default function Home() {
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [config, setConfig] = useState<SubtitleConfig>(DEFAULT_CONFIG);
  const [showRawEditor, setShowRawEditor] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'style'>('list');

  const handleUploadComplete = (rawSubtitles: any[], url: string) => {
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

  const handleDownloadSRT = () => {
    const primaryContent = stringifySRT(subtitles, 'primary');
    const primaryBlob = new Blob([primaryContent], { type: 'text/plain' });
    const primaryUrl = URL.createObjectURL(primaryBlob);
    
    const a = document.createElement('a');
    a.href = primaryUrl;
    a.download = 'subtitles_en.srt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (subtitles.some(s => s.secondaryText)) {
        const secondaryContent = stringifySRT(subtitles, 'secondary');
        const secondaryBlob = new Blob([secondaryContent], { type: 'text/plain' });
        const secondaryUrl = URL.createObjectURL(secondaryBlob);
        
        const b = document.createElement('a');
        b.href = secondaryUrl;
        b.download = 'subtitles_secondary.srt';
        document.body.appendChild(b);
        b.click();
        document.body.removeChild(b);
    }
  };

  if (!videoUrl) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 rounded-full blur-[120px]" />
        
        <div className="max-w-4xl w-full space-y-8 relative z-10">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-5xl font-black text-white tracking-tight">SubtitleGem</h1>
            </div>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              The professional AI-powered subtitle editor. Upload your video to generate, translate, and refine subtitles in seconds.
            </p>
          </div>
          <VideoUpload onUploadComplete={handleUploadComplete} />
        </div>
      </main>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden text-slate-200">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-indigo-600 rounded-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">SubtitleGem</span>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowRawEditor(true)}
            className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
          >
            <Code className="w-4 h-4" />
            <span>Raw Editor</span>
          </button>
          
          <div className="h-6 w-px bg-slate-800 mx-2" />
          
          <button 
            onClick={() => {
              if(confirm("Are you sure? Unsaved changes will be lost.")) {
                setVideoUrl(null);
                setSubtitles([]);
              }
            }}
            className="flex items-center space-x-2 px-3 py-1.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Reset</span>
          </button>

          <button 
            onClick={handleDownloadSRT}
            className="flex items-center space-x-2 px-4 py-1.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Export SRT</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Stage: Preview & Timeline */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
          {/* Video Preview Area */}
          <div className="flex-1 flex items-center justify-center p-6 bg-[url('/grid.svg')] bg-center relative">
            <div className="absolute inset-0 bg-slate-950/90 z-0" />
            <div className="relative z-10 w-full max-w-5xl shadow-2xl rounded-xl overflow-hidden ring-1 ring-slate-800">
               <VideoPreview 
                  videoUrl={videoUrl} 
                  subtitles={subtitles} 
                  config={config} 
                  currentTime={currentTime}
                  onTimeUpdate={setCurrentTime}
                  onDurationChange={setDuration}
                />
            </div>
          </div>

          {/* Timeline Area */}
          <div className="h-72 border-t border-slate-800 bg-slate-900/80 backdrop-blur flex flex-col shrink-0">
             <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                   <MonitorPlay className="w-3 h-3" />
                   <span>TIMELINE</span>
                </div>
                <div className="text-xs font-mono text-indigo-400">
                  {new Date(currentTime * 1000).toISOString().substr(11, 8)} / {new Date(duration * 1000).toISOString().substr(11, 8)}
                </div>
             </div>
             <div className="flex-1 relative overflow-hidden">
                <SubtitleTimeline 
                  subtitles={subtitles} 
                  duration={duration} 
                  onUpdate={setSubtitles}
                  currentTime={currentTime}
                  onSeek={setCurrentTime}
                />
             </div>
          </div>
        </div>

        {/* Right Sidebar: Tools */}
        <div className="w-96 border-l border-slate-800 bg-slate-900 flex flex-col shrink-0 z-10 shadow-xl">
           {/* Sidebar Tabs */}
           <div className="flex border-b border-slate-800">
              <button
                onClick={() => setActiveTab('list')}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'list' 
                    ? 'border-indigo-500 text-indigo-400 bg-slate-800/50' 
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <List className="w-4 h-4" />
                <span>Subtitles</span>
              </button>
              <button
                onClick={() => setActiveTab('style')}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'style' 
                    ? 'border-indigo-500 text-indigo-400 bg-slate-800/50' 
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Styles</span>
              </button>
           </div>

           {/* Sidebar Content */}
           <div className="flex-1 overflow-hidden relative">
              {activeTab === 'list' ? (
                <div className="absolute inset-0">
                  <SubtitleList 
                    subtitles={subtitles} 
                    onUpdate={setSubtitles} 
                    currentTime={currentTime}
                    onSeek={setCurrentTime}
                  />
                </div>
              ) : (
                <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
                   <ConfigPanel config={config} onChange={setConfig} />
                </div>
              )}
           </div>
        </div>
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
    </div>
  );
}
