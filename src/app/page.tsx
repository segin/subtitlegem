"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { GlobalSettingsDialog } from "@/components/GlobalSettingsDialog";
import { VideoPropertiesDialog, VideoProperties } from "@/components/VideoPropertiesDialog";
import { SubtitleLine, SubtitleConfig, DEFAULT_CONFIG, DEFAULT_GLOBAL_SETTINGS } from "@/types/subtitle";
import { QueueItem } from "@/lib/queue-manager";
import { parseSRTTime, stringifySRT } from "@/lib/srt-utils";
import { generateAss } from "@/lib/ass-utils";
import { useSubtitleHistory } from "@/hooks/useSubtitleHistory";
import { v4 as uuidv4 } from "uuid";
import { Upload, X, Download, Play, Pause, Save, RotateCcw, RotateCw, Plus, Trash2, Edit2, Check, Sparkles, AlertCircle, FileText, Settings, Code, Layers, FileVideo, LogOut, MonitorPlay, List } from "lucide-react";

import { ProjectSettingsDialog } from "@/components/ProjectSettingsDialog";

export default function Home() {
  // Undo/redo state management for subtitles
  const { subtitles, setSubtitles, undo, redo, canUndo, canRedo, resetHistory } = useSubtitleHistory([]);
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
  
  // Shift key tracking for Open Project
  const openShiftKeyRef = useRef(false);
  
  // Home screen restore state
  const [showRestoreOption, setShowRestoreOption] = useState(false);
  const [pendingProjectFile, setPendingProjectFile] = useState<File | null>(null);
  
  // Cache initial subtitles for "Reset to Original" feature
  const [initialSubtitles, setInitialSubtitles] = useState<SubtitleLine[] | null>(null);
  
  // Multi-selection state (shared between timeline and list)
  const [selectedSubtitleIds, setSelectedSubtitleIds] = useState<string[]>([]);
  const lastSelectedIdRef = useRef<string | null>(null);
  
  // Global settings dialog
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  
  // Queue Drawer State
  const [showQueue, setShowQueue] = useState(true);
  const [queueWidth, setQueueWidth] = useState(300);

  // Video Properties Dialog
  const [showVideoProperties, setShowVideoProperties] = useState(false);
  const [videoProperties, setVideoProperties] = useState<VideoProperties | null>(null);
  const [videoPropsLoading, setVideoPropsLoading] = useState(false);
  const [videoPropsError, setVideoPropsError] = useState<string | undefined>(undefined);

  // Fetch and cache video properties
  const handleShowVideoProperties = async () => {
    setShowVideoProperties(true);
    
    // Use cached if available
    if (videoProperties) return;
    
    if (!videoPath) {
      setVideoPropsError('No video loaded');
      return;
    }
    
    setVideoPropsLoading(true);
    setVideoPropsError(undefined);
    
    try {
      const res = await fetch(`/api/video-info?path=${encodeURIComponent(videoPath)}`);
      const data = await res.json();
      if (data.error) {
        setVideoPropsError(data.error);
      } else {
        setVideoProperties(data);
      }
    } catch (err: any) {
      setVideoPropsError(err.message || 'Failed to fetch video properties');
    } finally {
      setVideoPropsLoading(false);
    }
  };

  // Load persisted queue width
  useEffect(() => {
    const savedWidth = localStorage.getItem('subtitlegem_queue_width');
    if (savedWidth) {
       const w = parseInt(savedWidth);
       if (!isNaN(w) && w >= 250 && w <= 600) setQueueWidth(w);
    }
  }, []);

  const handleQueueWidthChange = (w: number) => {
    setQueueWidth(w);
    localStorage.setItem('subtitlegem_queue_width', w.toString());
  };

  // Load draft functionality
  const handleLoadDraft = async (draft: any) => {
    try {
      console.log("[Draft] Loading draft:", draft.id);
      const res = await fetch(`/api/drafts?id=${draft.id}`);
      const data = await res.json();
      
      console.log("[Draft] Loaded data:", { id: data.id, videoPath: data.videoPath });
      
      if (data.id) {
        resetHistory(data.subtitles || []); // Use resetHistory to clear undo stack
        setVideoPath(data.videoPath || null);
        const url = data.videoPath ? `/api/storage?path=${encodeURIComponent(data.videoPath)}` : null;
        console.log("[Draft] Setting video URL:", url);
        setVideoUrl(url);
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
          name: config.originalFilename || videoPath.split('/').pop() || "Untitled Project",
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

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleUploadComplete = (rawSubtitles: any[], url: string, lang: string, serverPath: string, detectedLanguage?: string, originalFilename?: string) => {
    const mapped: SubtitleLine[] = rawSubtitles.map(s => ({
      id: uuidv4(),
      startTime: parseSRTTime(s.startTime),
      endTime: parseSRTTime(s.endTime),
      text: s.text,
      secondaryText: s.secondaryText
    }));
    setSubtitles(mapped);
    setInitialSubtitles(mapped); // Cache for reset
    setVideoUrl(url);
    setVideoPath(serverPath);
    setVideoProperties(null); // Clear cached properties for new video
    setCurrentDraftId(null); // Reset for new uploads
    
    // Auto-set detected language and original filename
    setConfig(prev => ({
      ...prev,
      primaryLanguage: detectedLanguage || "English",
      secondaryLanguage: lang === "None" ? "Secondary" : lang,
      originalFilename: originalFilename || null
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
      subtitles,
      config,
    };
    
    const blob = new Blob([JSON.stringify(projectState, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subtitles_${Date.now()}.sgproj`;
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
        if (!json.subtitles) {
          throw new Error("Invalid project file format");
        }
        
        // Confirm unless shift was held
        if (!openShiftKeyRef.current && subtitles.length > 0) {
          if (!confirm("Replace existing subtitles with imported project?")) {
            return;
          }
        }
        
        setSubtitles(json.subtitles || []);
        setConfig(json.config || DEFAULT_CONFIG);
      } catch (err) {
        alert("Failed to load project: " + err);
      }
    };
    reader.readAsText(file);
    // Reset input and shift state
    e.target.value = '';
    openShiftKeyRef.current = false;
  };

  // Project Settings Handlers
  const handleUpdateConfig = useCallback((newConfig: Partial<SubtitleConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const handleReprocessVideo = async (language: string, model: string) => {
    if (!videoPath) throw new Error("No video loaded");
    
    // Call API to reprocess
    const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            filePath: videoPath,
            fileName: videoUrl?.split('/').pop() || "video.mp4",
            fileSize: 0, // Not needed for reprocess
            fileType: "video/mp4", // generic
            model: model,
            secondaryLanguage: config.secondaryLanguage || "None", 
            reprocess: true,
            primaryLanguage: language,
            existingFileUri: config.geminiFileUri
        })
    });
    
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Reprocessing failed");
    }
    
    const data = await response.json();
    if (data.subtitles) {
        setSubtitles(data.subtitles);
        // Add unique IDs if missing
        const processed = data.subtitles.map((s: any) => ({
            ...s,
            id: s.id || uuidv4()
        }));
        setSubtitles(processed);
        resetHistory(processed);
    }
  };

  const handleRetranslate = async (language: string, model: string) => {
     if (subtitles.length === 0) throw new Error("No subtitles to translate");

     const response = await fetch('/api/translate', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
             subtitles,
             targetLanguage: language,
             model: model
         })
     });

     if (!response.ok) {
         const err = await response.json();
         throw new Error(err.error || "Translation failed");
     }

     const data = await response.json();
     if (data.subtitles) {
         setSubtitles(data.subtitles);
         resetHistory(data.subtitles);
     }
  };
  
  // Ref for project loading
  const projectState = useRef<{videoPath: string} | null>(null);
  
  const loadProject = (path: string) => {
      // Placeholder for actual project reloading logic if needed
      // Currently just resets subtitles which effectively "reloads" if we kept the video
      if (!path) return;
      if (initialSubtitles) {
          setSubtitles(initialSubtitles);
          resetHistory(initialSubtitles);
      }
  };

  const handleCloseProject = async () => {
    // If there's a saved draft, offer to delete it
    if (currentDraftId) {
      const shouldDelete = confirm("Delete this project from Recent Projects?");
      if (shouldDelete) {
        try {
          await fetch(`/api/drafts?id=${currentDraftId}`, { method: 'DELETE' });
        } catch (err) {
          console.error("Failed to delete draft:", err);
        }
      }
    }
    
    setVideoUrl(null);
    setVideoPath(null);
    resetHistory([]);
    setCurrentDraftId(null);
    setConfig(DEFAULT_CONFIG);
    setInitialSubtitles(null);
    setSelectedSubtitleIds([]);
  };

  // Handle subtitle selection with Shift+click range selection
  const handleSubtitleSelect = (id: string, shiftKey: boolean) => {
    if (shiftKey && lastSelectedIdRef.current) {
      // Range selection
      const lastIndex = subtitles.findIndex(s => s.id === lastSelectedIdRef.current);
      const currentIndex = subtitles.findIndex(s => s.id === id);
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeIds = subtitles.slice(start, end + 1).map(s => s.id);
        setSelectedSubtitleIds(rangeIds);
        return;
      }
    }
    
    // Toggle single selection
    setSelectedSubtitleIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        lastSelectedIdRef.current = id;
        return [...prev, id];
      }
    });
  };

  // Split a subtitle at its midpoint
  const splitSubtitle = (id: string) => {
    const index = subtitles.findIndex(s => s.id === id);
    if (index === -1) return;
    
    const sub = subtitles[index];
    const midTime = (sub.startTime + sub.endTime) / 2;
    
    // Split text roughly in half (at space if possible)
    const text = sub.text || "";
    const midTextIndex = Math.floor(text.length / 2);
    const spaceIndex = text.indexOf(' ', midTextIndex);
    const splitAt = spaceIndex !== -1 ? spaceIndex : midTextIndex;
    
    const firstHalf: SubtitleLine = {
      id: uuidv4(),
      startTime: sub.startTime,
      endTime: midTime,
      text: text.slice(0, splitAt).trim(),
      secondaryText: sub.secondaryText ? sub.secondaryText.slice(0, Math.floor(sub.secondaryText.length / 2)).trim() : undefined,
      primaryColor: sub.primaryColor,
      secondaryColor: sub.secondaryColor,
    };
    
    const secondHalf: SubtitleLine = {
      id: uuidv4(),
      startTime: midTime,
      endTime: sub.endTime,
      text: text.slice(splitAt).trim(),
      secondaryText: sub.secondaryText ? sub.secondaryText.slice(Math.floor(sub.secondaryText.length / 2)).trim() : undefined,
      primaryColor: sub.primaryColor,
      secondaryColor: sub.secondaryColor,
    };
    
    const newSubtitles = [...subtitles];
    newSubtitles.splice(index, 1, firstHalf, secondHalf);
    setSubtitles(newSubtitles);
    setSelectedSubtitleIds([]);
  };

  if (!videoUrl) {
    return (
      <main className="min-h-screen h-screen bg-[#1e1e1e] flex flex-col text-[#cccccc] overflow-hidden">
        {/* Top Header Bar with Menu and App Name */}
        <div className="h-8 bg-[#333333] border-b border-[#252526] flex items-center px-1 shrink-0 select-none">
          <div className="flex items-center gap-1.5 ml-2 mr-3">
            <span className="font-bold tracking-tight text-[#e1e1e1] text-[13px]">SUBTITLEGEM</span>
          </div>
          <div className="w-px h-3.5 bg-[#444444] mx-1" />
          <MenuBar 
            isUploadScreen={true}
            onGlobalSettings={() => setShowGlobalSettings(true)}
          />
        </div>

        {/* Queue Toggle Button (Right-aligned in header) */}
        <div className="absolute right-0 top-0 h-8 flex items-center pr-2">
            <button 
                onClick={() => setShowQueue(!showQueue)}
                className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium hover:bg-[#3e3e42] hover:text-[#e1e1e1] text-[#cccccc] transition-colors rounded-sm ml-2 border border-transparent hover:border-[#444444]"
            >
                <Layers className="w-3 h-3" />
                Queue
            </button>
        </div>
        
        {/* Main Content Row */}
        <div className="flex-1 flex overflow-hidden">
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
              <VideoUpload 
                onUploadComplete={handleUploadComplete} 
                pendingProjectFile={pendingProjectFile}
              />
              
              {/* Restore existing project option */}
              <div className="mt-6 w-full max-w-sm">
                <label className="flex items-center gap-2 text-sm text-[#888888] cursor-pointer hover:text-[#cccccc] transition-colors">
                  <input 
                    type="checkbox" 
                    checked={showRestoreOption}
                    onChange={(e) => {
                      setShowRestoreOption(e.target.checked);
                      if (!e.target.checked) setPendingProjectFile(null);
                    }}
                    className="accent-[#0e639c]"
                  />
                  Restore existing project export
                </label>
                
                {showRestoreOption && (
                  <div className="mt-3 p-3 bg-[#1e1e1e] border border-[#333333] rounded">
                    <p className="text-xs text-[#666666] mb-2">Select a .sgproj file to restore subtitles after video upload:</p>
                    <input 
                      type="file" 
                      accept=".sgproj,.json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setPendingProjectFile(file || null);
                      }}
                      className="text-xs text-[#888888] file:mr-2 file:py-1 file:px-2 file:border-0 file:text-xs file:bg-[#3e3e42] file:text-[#cccccc] file:cursor-pointer hover:file:bg-[#4e4e52]"
                    />
                    {pendingProjectFile && (
                      <p className="mt-2 text-xs text-green-400">✓ {pendingProjectFile.name}</p>
                    )}
                  </div>
                )}
              </div>
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
          width={queueWidth}
          onWidthChange={handleQueueWidthChange}
          isOpen={showQueue}
          onClose={() => setShowQueue(false)}
        />
        </div>
        
        <GlobalSettingsDialog
          isOpen={showGlobalSettings}
          onClose={() => setShowGlobalSettings(false)}
        />
        
        <ProjectSettingsDialog
            isOpen={showProjectSettings}
            onClose={() => setShowProjectSettings(false)}
            config={{
                primaryLanguage: config.primaryLanguage,
                secondaryLanguage: config.secondaryLanguage,
                geminiFileUri: config.geminiFileUri,
                geminiFileExpiration: config.geminiFileExpiration,
                geminiModel: config.geminiModel || DEFAULT_GLOBAL_SETTINGS.defaultGeminiModel,
                ffmpeg: config.ffmpeg,
            }}
            onUpdateConfig={handleUpdateConfig}
            onReprocess={handleReprocessVideo}
            onRetranslate={handleRetranslate}
            onResetToOriginal={() => loadProject(projectState.current?.videoPath || "")}
            canReset={!!projectState.current}
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
              setVideoUrl(null);
              setVideoPath(null);
              resetHistory([]); // Use resetHistory to clear undo stack
              setConfig(DEFAULT_CONFIG);
              setCurrentDraftId(null);
            }}
            onExport={handleExport}
            hasSecondarySubtitles={subtitles.some(s => !!s.secondaryText)}
            primaryLanguage={config.primaryLanguage}
            secondaryLanguage={config.secondaryLanguage}
            onCloseProject={handleCloseProject}
            onSaveProject={handleSaveProject}
            onOpenProject={(e?: React.MouseEvent) => {
              openShiftKeyRef.current = e?.shiftKey || false;
              document.getElementById('project-upload')?.click();
            }}
            onProjectSettings={() => setShowProjectSettings(true)}
            onReprocessVideo={() => setShowProjectSettings(true)}
            onGlobalSettings={() => setShowGlobalSettings(true)}
            onVideoProperties={handleShowVideoProperties}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
          <input 
            type="file" 
            id="project-upload" 
            className="hidden" 
            accept=".sgproj,.json" 
            onChange={handleOpenProject}
          />
        </div>

        
        <div className="flex items-center space-x-2 mr-4"> {/* Adjusted margin */}

          <button 
              onClick={() => setShowQueue(!showQueue)}
              className="flex items-center space-x-1.5 px-2 py-1 text-xs hover:bg-[#3e3e42] hover:text-white rounded-sm transition-colors text-[#cccccc]"
              title={showQueue ? "Hide Queue" : "Show Queue"}
          >
              <Layers className="w-3 h-3" />
              <span>Queue</span>
          </button>
          
          <div className="w-px h-3 bg-[#444444] mx-1" />
          
          <button 
            onClick={() => setShowRawEditor(true)}
            className="flex items-center space-x-1.5 px-2 py-1 text-xs bg-[#3e3e42] hover:bg-[#4e4e52] border border-[#2d2d2d] hover:border-[#555555] rounded-sm transition-all"
          >
            <Code className="w-3 h-3" />
            <span>Edit RAW</span>
          </button>
          
          <button 
            onClick={() => {
              setVideoUrl(null);
              setSubtitles([]);
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
                  selectedIds={selectedSubtitleIds}
                  onSelect={handleSubtitleSelect}
                  onSplit={splitSubtitle}
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
                    secondaryLanguage={config.secondaryLanguage || "Simplified Chinese"}
                    selectedIds={selectedSubtitleIds}
                    onSelect={handleSubtitleSelect}
                    onSplit={splitSubtitle}
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
                        filename: config.originalFilename || undefined,
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
          width={queueWidth}
          onWidthChange={handleQueueWidthChange}
          isOpen={showQueue}
          onClose={() => setShowQueue(false)}
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
        onResetToOriginal={() => {
          if (initialSubtitles) {
            resetHistory([...initialSubtitles]);
          }
        }}
        canReset={initialSubtitles !== null && initialSubtitles.length > 0}
      />
      
      <GlobalSettingsDialog
        isOpen={showGlobalSettings}
        onClose={() => setShowGlobalSettings(false)}
      />
      
      <VideoPropertiesDialog
        isOpen={showVideoProperties}
        onClose={() => setShowVideoProperties(false)}
        properties={videoProperties}
        loading={videoPropsLoading}
        error={videoPropsError}
      />
    </div>
  );
}