"use client";

import React, { useState, useEffect } from "react";
import { VideoUpload } from "@/components/VideoUpload";
import { SubtitleTimeline } from "@/components/SubtitleTimeline";
import { VideoPreview } from "@/components/VideoPreview";
import { ConfigPanel } from "@/components/ConfigPanel";
import { SubtitleList } from "@/components/SubtitleList";
import { RawEditor } from "@/components/RawEditor";
import { QueueSidebar } from "@/components/QueueSidebar";
import { QueuePanel } from "@/components/QueuePanel";
import { ExportControls } from "@/components/ExportControls";
import { SubtitleLine, SubtitleConfig, DEFAULT_CONFIG } from "@/types/subtitle";
import { QueueItem } from "@/lib/queue-manager";
import { parseSRTTime, stringifySRT } from "@/lib/srt-utils";
import { v4 as uuidv4 } from "uuid";
import { Download, Sparkles, Code, Settings, List, MonitorPlay, LogOut, FileVideo, Play, Pause } from "lucide-react";

export default function Home() {
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [config, setConfig] = useState<SubtitleConfig>(DEFAULT_CONFIG);
  const [showRawEditor, setShowRawEditor] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'style'>('list');
  
  // Queue state
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queuePaused, setQueuePaused] = useState(false);
  
  // Poll queue status
  useEffect(() => {
    const pollQueue = async () => {
      try {
        const res = await fetch('/api/queue');
        if (res.ok) {
          const data = await res.json();
          setQueueItems(data.items);
          setQueuePaused(data.isPaused);
        }
      } catch (err) {
        console.error('Failed to poll queue:', err);
      }
    };
    
    pollQueue();
    const interval = setInterval(pollQueue, 2000); // Poll every 2 seconds
    
    return () => clearInterval(interval);
  }, []);

  const handleUploadComplete = (rawSubtitles: any[], url: string, lang: string, serverPath: string) => {
    const mapped: SubtitleLine[] = rawSubtitles.map(s => ({
      id: uuidv4(),
      startTime: parseSRTTime(s.startTime),
      endTime: parseSRTTime(s.endTime),
      text: s.text,
      secondaryText: s.secondaryText
    }));
    setSubtitles(mapped);
    setVideoUrl(url);
    setVideoPath(serverPath);
  };
  
  const handleEditFromQueue = async (item: QueueItem) => {
    // Load the queue item back into the editor
    // User wants to edit before processing
    
    // Remove from queue
    await fetch(`/api/queue?id=${item.id}`, { method: 'DELETE' });
    
    // If it has results, load them
    if (item.result) {
      setSubtitles(item.result.subtitles);
      setVideoUrl(URL.createObjectURL(new File([], item.file.name)));
      setVideoPath(item.result.videoPath);
    }
    
    // Refresh queue
    const res = await fetch('/api/queue');
    if (res.ok) {
      const data = await res.json();
      setQueueItems(data.items);
    }
  };
  
  const handleRemoveFromQueue = async (id: string) => {
    await fetch(`/api/queue?id=${id}`, { method: 'DELETE' });
    
    // Refresh queue
    const res = await fetch('/api/queue');
    if (res.ok) {
      const data = await res.json();
      setQueueItems(data.items);
    }
  };
  
  const toggleQueuePause = async () => {
    const action = queuePaused ? 'resume' : 'pause';
    await fetch('/api/queue', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    
    setQueuePaused(!queuePaused);
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
      <main className="min-h-screen bg-[#1e1e1e] flex flex-col items-center justify-center p-0 text-[#cccccc]">
        <div className="w-full max-w-lg border border-[#333333] bg-[#252526] shadow-xl">
          <div className="h-8 bg-[#333333] flex items-center px-3 text-xs font-semibold text-[#cccccc] select-none">
            SubtitleGem - New Project
          </div>
          <div className="p-8 flex flex-col items-center">
            <div className="mb-6 p-4 bg-[#1e1e1e] border border-[#333333]">
              <FileVideo className="w-12 h-12 text-[#555555]" />
            </div>
            <h1 className="text-xl font-medium text-[#e1e1e1] mb-2">Welcome to SubtitleGem</h1>
            <p className="text-sm text-[#888888] mb-8 text-center">Start by importing a video file to generate subtitles.</p>
            <VideoUpload onUploadComplete={handleUploadComplete} />
          </div>
          
          {/* Queue Display on Upload Screen */}
          <div className="absolute bottom-4 right-4 w-80">
            <QueuePanel
              items={queueItems}
              isPaused={queuePaused}
              onPauseToggle={toggleQueuePause}
              onRemove={async (id, force) => {
                await fetch(`/api/queue?id=${id}&force=${force}`, { method: 'DELETE' });
              }}
              onDownload={(item) => {
                if (item.result?.videoPath) {
                  window.open(`/api/export?id=${item.id}`, '_blank');
                }
              }}
              className="shadow-lg"
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-[#cccccc] font-sans overflow-hidden">
      {/* Top Menu Bar */}
      <header className="h-9 border-b border-[#333333] bg-[#2d2d2d] flex items-center justify-between px-3 shrink-0 select-none">
        <div className="flex items-center space-x-4">
          <span className="font-bold text-sm text-[#e1e1e1] tracking-wide">SUBTITLEGEM</span>
          <div className="h-4 w-px bg-[#444444]" />
          <nav className="flex space-x-1">
            <button className="px-2 py-0.5 text-xs hover:bg-[#3e3e42] rounded-sm transition-colors">File</button>
            <button className="px-2 py-0.5 text-xs hover:bg-[#3e3e42] rounded-sm transition-colors">Edit</button>
            <button className="px-2 py-0.5 text-xs hover:bg-[#3e3e42] rounded-sm transition-colors">View</button>
          </nav>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Queue controls */}
          {queueItems.length > 0 && (
            <>
              <button
                onClick={toggleQueuePause}
                className="flex items-center space-x-1.5 px-2 py-1 text-xs bg-[#3e3e42] hover:bg-[#4e4e52] border border-[#2d2d2d] hover:border-[#555555] rounded-sm transition-all"
                title={queuePaused ? "Resume Processing" : "Pause Processing"}
              >
                {queuePaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                <span>{queuePaused ? "Resume" : "Pause"} Queue</span>
              </button>
              
              <span className="text-[10px] text-[#888888] font-mono">
                {queueItems.filter(i => i.status === 'pending').length} queued
              </span>
              
              <div className="h-4 w-px bg-[#444444]" />
            </>
          )}
          
          <button 
            onClick={() => setShowRawEditor(true)}
            className="flex items-center space-x-1.5 px-2 py-1 text-xs bg-[#3e3e42] hover:bg-[#4e4e52] border border-[#2d2d2d] hover:border-[#555555] rounded-sm transition-all"
          >
            <Code className="w-3 h-3" />
            <span>Edit RAW</span>
          </button>
          
          <button 
            onClick={() => {
              if(confirm("Discard current project?")) {
                setVideoUrl(null);
                setSubtitles([]);
              }
            }}
            className="flex items-center space-x-1.5 px-2 py-1 text-xs hover:bg-[#3e3e42] hover:text-white rounded-sm transition-colors text-[#aaaaaa]"
          >
            <LogOut className="w-3 h-3" />
            <span>Close</span>
          </button>

          <button 
            onClick={handleDownloadSRT}
            className="flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold bg-[#007acc] hover:bg-[#0062a3] text-white rounded-sm border border-[#007acc] transition-colors"
          >
            <Download className="w-3 h-3" />
            <span>Export SRT</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Stage: Preview & Timeline */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e] relative">
          {/* Video Preview Area */}
          <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] relative overflow-hidden">
             {/* Checkerboard Pattern for Transparency */}
            <div className="absolute inset-0 opacity-5" 
                style={{ backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }} 
            />
            
            <div className="relative z-10 w-full h-full p-4 flex items-center justify-center">
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
          <div className="h-64 border-t border-[#333333] bg-[#252526] flex flex-col shrink-0">
             <div className="h-6 bg-[#2d2d2d] border-b border-[#333333] flex items-center justify-between px-2 select-none">
                <div className="flex items-center space-x-2 text-[10px] font-bold text-[#888888] uppercase tracking-wider">
                   <MonitorPlay className="w-3 h-3" />
                   <span>Sequence 01</span>
                </div>
                <div className="text-[10px] font-mono text-[#007acc]">
                  {new Date(currentTime * 1000).toISOString().substr(11, 8)} <span className="text-[#555555]">/</span> {new Date(duration * 1000).toISOString().substr(11, 8)}
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

        {/*  Right Sidebar: Tools */}
        <div className="w-96 border-l border-[#333333] bg-[#252526] flex flex-col shrink-0 z-10 shadow-xl">
           {/* Sidebar Tabs */}
           <div className="flex border-b border-[#333333]">
              <button
                onClick={() => setActiveTab('list')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 text-xs font-medium transition-colors border-b-2 ${ 
                  activeTab === 'list' 
                    ? 'border-[#007acc] text-[#e1e1e1] bg-[#2d2d2d]' 
                    : 'border-transparent text-[#888888] hover:text-[#cccccc] hover:bg-[#2a2a2a]'
                }`}
              >
                <List className="w-4 h-4" />
                <span>Subtitles</span>
              </button>
              <button
                onClick={() => setActiveTab('style')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 text-xs font-medium transition-colors border-b-2 ${ 
                  activeTab === 'style' 
                    ? 'border-[#007acc] text-[#e1e1e1] bg-[#2d2d2d]' 
                    : 'border-transparent text-[#888888] hover:text-[#cccccc] hover:bg-[#2a2a2a]'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Styles</span>
              </button>
           </div>

           {/* Sidebar Content */}
           <div className="flex-1 overflow-hidden relative flex flex-col">
              {activeTab === 'list' ? (
                <div className="flex-1 overflow-hidden">
                  <SubtitleList 
                    subtitles={subtitles} 
                    onUpdate={setSubtitles} 
                    currentTime={currentTime}
                    onSeek={setCurrentTime}
                    secondaryLanguage="Simplified Chinese"
                  />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                   <ConfigPanel config={config} onChange={setConfig} />
                </div>
              )}
              
              {/* Export Controls - Always visible at bottom */}
              <ExportControls
                subtitles={subtitles}
                videoPath={videoPath}
                config={config}
                queueItems={queueItems}
                onExport={async (sampleDuration) => {
                  if (!videoPath) return;
                  
                  try {
                    // Add export job to queue
                    const response = await fetch('/api/export', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        videoPath,
                        subtitles,
                        config,
                        sampleDuration,
                      }),
                    });
                    
                    if (!response.ok) {
                      const error = await response.json();
                      alert(`Export failed: ${error.error || 'Unknown error'}`);
                      return;
                    }
                    
                    const result = await response.json();
                    console.log('Export job added to queue:', result);
                    
                    // Refresh queue to show new job
                    const queueRes = await fetch('/api/queue');
                    if (queueRes.ok) {
                      const data = await queueRes.json();
                      setQueueItems(data.items);
                    }
                  } catch (err: any) {
                    alert(`Export failed: ${err.message}`);
                  }
                }}
              />
              
              {/* Queue Display using shared component */}
              <QueuePanel
                items={queueItems}
                isPaused={queuePaused}
                onPauseToggle={toggleQueuePause}
                onRemove={async (id, force) => {
                  await fetch(`/api/queue?id=${id}&force=${force}`, { method: 'DELETE' });
                }}
                onDownload={(item) => {
                  if (item.result?.videoPath) {
                    window.open(`/api/export?id=${item.id}`, '_blank');
                  }
                }}
              />
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