"use client";

import React, { useState, useEffect } from "react";
import { VideoUpload } from "@/components/VideoUpload";
import { SubtitleTimeline } from "@/components/SubtitleTimeline";
import { VideoPreview } from "@/components/VideoPreview";
import { ConfigPanel } from "@/components/ConfigPanel";
import { SubtitleList } from "@/components/SubtitleList";
import { RawEditor } from "@/components/RawEditor";
import { QueueDrawer } from "@/components/QueueDrawer";
import { ExportControls } from "@/components/ExportControls";
import { MenuBar } from "@/components/MenuBar";
import { DraftsSidebar } from "@/components/DraftsSidebar";
import { SubtitleLine, SubtitleConfig, DEFAULT_CONFIG } from "@/types/subtitle";
import { QueueItem } from "@/lib/queue-manager";
import { parseSRTTime, stringifySRT } from "@/lib/srt-utils";
import { generateAss } from "@/lib/ass-utils";
import { v4 as uuidv4 } from "uuid";
import { Download, Sparkles, Code, Settings, List, MonitorPlay, LogOut, FileVideo, Play, Pause } from "lucide-react";

import { ProjectSettingsDialog } from "@/components/ProjectSettingsDialog";

export default function Home() {
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [config, setConfig] = useState<SubtitleConfig>(DEFAULT_CONFIG);
  const [showRawEditor, setShowRawEditor] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'style'>('list');
  
  // Queue state
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queuePaused, setQueuePaused] = useState(false);
  
  // Draft state
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);

  // Load draft functionality
  const handleLoadDraft = async (draft: any) => {
    try {
      const res = await fetch(`/api/drafts?id=${draft.id}`);
      const data = await res.json();
      
      if (data.id) {
        setSubtitles(data.subtitles || []);
        setVideoPath(data.videoPath || null);
        setVideoUrl(data.videoPath ? `/api/storage?path=${encodeURIComponent(data.videoPath)}` : null);
        setCurrentDraftId(data.id);
        if (data.config) setConfig(data.config);
      }
    } catch (err) {
      console.error("Failed to load draft:", err);
    }
  };

  // Auto-save debounced
  useEffect(() => {
    if (!videoUrl || !videoPath || subtitles.length === 0) return;

    const timeoutId = setTimeout(async () => {
      try {
        const body = {
          id: currentDraftId || undefined,
          name: videoPath.split('/').pop() || "Untitled Project",
          videoPath,
          subtitles,
          config,
        };
        
        const res = await fetch('/api/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        
        const data = await res.json();
        if (data.id && !currentDraftId) {
          setCurrentDraftId(data.id);
        }
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }, 5000); // 5 second debounce for auto-save

    return () => clearTimeout(timeoutId);
  }, [subtitles, videoPath, videoUrl, config, currentDraftId]);
  
  // Real-time queue updates via Polling (Robust Fallback)
  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/queue');
      if (res.ok) {
         const data = await res.json();
         setQueueItems(data.items);
         setQueuePaused(data.paused);
      }
    } catch (error) {
      console.error("Queue poll failed:", error);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchQueue();

    // Poll every 1 second
    const interval = setInterval(fetchQueue, 1000);

    return () => clearInterval(interval);
  }, [fetchQueue]);

  const handleUploadComplete = (rawSubtitles: any[], url: string, lang: string, serverPath: string, detectedLanguage?: string) => {
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
    setCurrentDraftId(null); // Reset for new uploads
    
    // Auto-set detected language
    setConfig(prev => ({
      ...prev,
      primaryLanguage: detectedLanguage || "English",
      secondaryLanguage: lang === "None" ? "Secondary" : lang
    }));
  };
  
  const handleEditFromQueue = async (item: QueueItem) => {
    // Load the queue item back into the editor
    // User wants to edit before processing
    
    // Remove from queue
    await fetch(`/api/queue?id=${item.id}`, { method: 'DELETE' });
    
    // If it has results, load them
    if (item.result?.subtitles && item.result?.videoPath) {
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

  const handleExport = (format: 'ass' | 'srt' | 'srt-primary' | 'srt-secondary' | 'txt') => {
    let content = "";
    let fileName = "subtitles";
    let mimeType = "text/plain";

    if (format === 'ass') {
      content = generateAss(subtitles, config);
      fileName = 'project.ass';
    } else if (format === 'srt' || format === 'srt-primary') {
      content = stringifySRT(subtitles, 'primary');
      fileName = 'subtitles_en.srt';
    } else if (format === 'srt-secondary') {
      content = stringifySRT(subtitles, 'secondary');
      fileName = 'subtitles_secondary.srt';
    } else if (format === 'txt') {
      content = subtitles.map(s => s.text).join('\n');
      fileName = 'transcript.txt';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSaveProject = () => {
    const projectState = {
      version: 1,
      timestamp: Date.now(),
      videoPath,
      subtitles,
      config,
    };
    
    const blob = new Blob([JSON.stringify(projectState, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoPath?.split('/').pop()?.split('.')[0] || "project"}.sgproj`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        // Basic validation
        if (!json.version || !json.subtitles) {
          throw new Error("Invalid project file format");
        }
        
        if (confirm("Load project? Any unsaved changes will be lost.")) {
          setSubtitles(json.subtitles || []);
          setConfig(json.config || DEFAULT_CONFIG);
          setVideoPath(json.videoPath || null);
          setVideoUrl(json.videoPath ? `/api/storage?path=${encodeURIComponent(json.videoPath)}` : null);
          setCurrentDraftId(null); // Treat as new session or find persistent draft logic later
        }
      } catch (err) {
        alert("Failed to load project: " + err);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleCloseProject = () => {
    if(confirm("Discard current project?")) {
      setVideoUrl(null);
      setVideoPath(null);
      setSubtitles([]);
      setCurrentDraftId(null);
      setConfig(DEFAULT_CONFIG);
    }
  };

  if (!videoUrl) {
    return (
      <main className="min-h-screen h-screen bg-[#1e1e1e] flex text-[#cccccc] overflow-hidden">
        {/* Draft Projects Sidebar - Left side */}
        <DraftsSidebar 
          onLoadDraft={handleLoadDraft}
        />

        {/* Main Upload Area - Center */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-auto">
          <div className="w-full max-w-lg lg:max-w-2xl xl:max-w-3xl border border-[#333333] bg-[#252526] shadow-xl">
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
          </div>
        </div>

        {/* Queue Drawer - Right side */}
        <QueueDrawer
          items={queueItems}
          isPaused={queuePaused}
          onPauseToggle={toggleQueuePause}
          onRemove={async (id: string, force?: boolean) => {
            await fetch(`/api/queue?id=${id}&force=${force}`, { method: 'DELETE' });
            // Immediate re-fetch fallback
            const res = await fetch('/api/queue');
            if (res.ok) {
               const data = await res.json();
               setQueueItems(data.items);
            }
          }}
          onRefresh={async () => {
             const res = await fetch('/api/queue');
             if (res.ok) {
                const data = await res.json();
                setQueueItems(data.items);
             }
          }}
          onDownload={(item: QueueItem) => {
            if (item.result?.videoPath) {
              window.open(`/api/export?id=${item.id}`, '_blank');
            }
          }}
        />
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
          <MenuBar
            onNewProject={() => {
              if(confirm("Discard current project and start new?")) {
                setVideoUrl(null);
                setVideoPath(null);
                setSubtitles([]);
                setConfig(DEFAULT_CONFIG);
                setCurrentDraftId(null);
              }
            }}
            onExport={handleExport}
            hasSecondarySubtitles={subtitles.some(s => !!s.secondaryText)}
            primaryLanguage={config.primaryLanguage}
            secondaryLanguage={config.secondaryLanguage}
            onCloseProject={handleCloseProject}
            onSaveProject={handleSaveProject}
            onOpenProject={() => document.getElementById('project-upload')?.click()}
            onProjectSettings={() => setShowProjectSettings(true)}
          />
          <input 
            type="file" 
            id="project-upload" 
            className="hidden" 
            accept=".sgproj,.json" 
            onChange={handleOpenProject}
          />
        </div>

        
        <div className="flex items-center space-x-2 mr-24"> {/* mr-24 gives space for queue button */}
          
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
        </div>
      </header>

      {/* Main Workspace - Always horizontal layout */}
      <div className="flex-1 flex flex-row overflow-hidden">
        
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

          {/* Timeline Area - Smaller on mobile */}
          <div className="h-40 lg:h-64 border-t border-[#333333] bg-[#252526] flex flex-col shrink-0">
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

        {/*  Right Sidebar: Tools - Width adapts to screen */}
        <div className="w-64 md:w-80 lg:w-96 xl:w-[28rem] border-l border-[#333333] bg-[#252526] flex flex-col shrink-0 z-10 shadow-xl">
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
                onChangeConfig={setConfig}
                onExport={async (sampleDuration, ffmpegConfig) => {
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
                        ffmpegConfig,
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
              
           </div>
        </div>

        {/* Queue Panel - Inline on desktop, slide-out on mobile */}
        <QueueDrawer
          items={queueItems}
          isPaused={queuePaused}
          onPauseToggle={toggleQueuePause}
          onRemove={async (id: string, force?: boolean) => {
            await fetch(`/api/queue?id=${id}&force=${force}`, { method: 'DELETE' });
            // Immediate re-fetch fallback
            const res = await fetch('/api/queue');
            if (res.ok) {
               const data = await res.json();
               setQueueItems(data.items);
            }
          }}
          onRefresh={async () => {
             const res = await fetch('/api/queue');
             if (res.ok) {
                const data = await res.json();
                setQueueItems(data.items);
             }
          }}
          onDownload={(item: QueueItem) => {
            if (item.result?.videoPath) {
              window.open(`/api/export?id=${item.id}`, '_blank');
            }
          }}
        />
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
      
      <ProjectSettingsDialog
        isOpen={showProjectSettings}
        onClose={() => setShowProjectSettings(false)}
        config={config}
        onUpdateConfig={(updates) => setConfig(prev => ({ ...prev, ...updates }))}
        onReprocess={async (lang, model) => {
            const res = await fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'reprocess',
                    fileUri: config.geminiFileUri,
                    language: lang,
                    secondaryLanguage: config.secondaryLanguage,
                    model: model 
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSubtitles(data.subtitles);
        }}
        onRetranslate={async (secLang, model) => {
            const res = await fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'translate',
                    subtitles: subtitles,
                    secondaryLanguage: secLang,
                    model: model
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSubtitles(data.subtitles);
        }}
      />
    </div>
  );
}