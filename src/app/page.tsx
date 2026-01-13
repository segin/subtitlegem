"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { VideoUpload, UploadMode } from "@/components/VideoUpload";
import { SubtitleTimeline, TimelineRef } from "@/components/SubtitleTimeline";
import { VideoPreview } from "@/components/VideoPreview";
import { ConfigPanel } from "@/components/ConfigPanel";
import { SubtitleList } from "@/components/SubtitleList";
import { QueueDrawer } from "@/components/QueueDrawer";
import { ExportControls } from "@/components/ExportControls";
import { MenuBar } from "@/components/MenuBar";
import { DraftsSidebar } from "@/components/DraftsSidebar";
import { GlobalSettingsDialog, TabId } from "@/components/GlobalSettingsDialog";
import { AboutDialog } from "@/components/AboutDialog";
import { VideoPropertiesDialog, VideoProperties } from "@/components/VideoPropertiesDialog";
import { VideoLibrary } from "@/components/VideoLibrary";
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcutsDialog";
import { ShiftTimingsDialog } from "@/components/ShiftTimingsDialog";
import { FindReplaceDialog, FindOptions, FindResult } from "@/components/FindReplaceDialog";
import { 
  SubtitleLine, 
  SubtitleConfig, 
  DEFAULT_CONFIG, 
  DEFAULT_GLOBAL_SETTINGS,
  VideoClip,
  TimelineClip,
  TimelineImage,
  ImageAsset,
  DEFAULT_PROJECT_CONFIG,
  ProjectConfig,
} from "@/types/subtitle";
import { QueueItem } from "@/lib/queue-manager";
import { parseTimestamp, generateSrtContent } from "@/lib/time-utils";
import { formatTimestamp } from "@/lib/time-utils";
import { getRangeSelectionIds, mergeSubtitles } from "@/lib/subtitle-utils";
import { generateAss } from "@/lib/ass-utils";
import { useHomeState, RawSubtitleItem, DraftItem } from "@/hooks/useHomeState";
import { getProjectDuration } from "@/lib/timeline-utils";
import { checkClipIntegrity, canRelinkClip } from "@/lib/integrity-utils";
import { v4 as uuidv4 } from "uuid";
import { Upload, X, Download, Play, Pause, Save, RotateCcw, RotateCw, Plus, Trash2, Edit2, Check, Sparkles, AlertCircle, FileText, Settings, Code, Layers, FileVideo, LogOut, MonitorPlay, List } from "lucide-react";

import { ProjectSettingsDialog } from "@/components/ProjectSettingsDialog";
import { ReprocessDialog, ReprocessOptions } from "@/components/ReprocessDialog";

export default function Home() {
  const homeState = useHomeState();
  const {
    subtitles, setSubtitles, undo, redo, canUndo, canRedo, resetHistory,
    videoUrl, setVideoUrl,
    videoPath, setVideoPath,
    duration, setDuration,
    currentTime, setCurrentTime,
    config, setConfig,
    showProjectSettings, setShowProjectSettings,
    activeTab, setActiveTab,
    queueItems, setQueueItems,
    queuePaused,
    currentDraftId, setCurrentDraftId,
    showRestoreOption, setShowRestoreOption,
    loading, setLoading,
    initialSubtitles, setInitialSubtitles,
    selectedSubtitleIds, setSelectedSubtitleIds,
    lastSelectedIdRef,
    showGlobalSettings, setShowGlobalSettings,
    globalSettingsTab, setGlobalSettingsTab,
    showShortcuts, setShowShortcuts,
    showAbout, setShowAbout,
    showShiftTimings, setShowShiftTimings,
    showFindReplace, setShowFindReplace,
    clipboardSubtitles, setClipboardSubtitles,
    showQueue, setShowQueue,
    queueWidth,
    showVideoProperties, setShowVideoProperties,
    videoProperties, setVideoProperties,
    videoPropsLoading,
    videoPropsError,
    videoClips, setVideoClips,
    timelineClips, setTimelineClips,
    projectConfig, setProjectConfig,
    uploadMode, setUploadMode,
    selectedClipId, setSelectedClipId,
    showVideoLibrary, setShowVideoLibrary,
    isLibraryCollapsed, setIsLibraryCollapsed,
    imageAssets, setImageAssets,
    timelineImages, setTimelineImages,
    selectedImageId, setSelectedImageId,
    timelineRef,
    drafts, setDrafts,
    draftsLoading,
    fetchDrafts,
    handleDeleteDraft,
    fetchVideoProperties,
    handleQueueWidthChange,
    toggleQueuePause,
    fetchQueue,
    isMultiVideoMode,
    setQueuePaused,
  } = homeState;

  // Shift key tracking for Open Project
  const openShiftKeyRef = useRef(false);
  
  // Home screen restore state
  const [pendingProjectFile, setPendingProjectFile] = useState<File | null>(null);
  
  // Reprocess dialog state
  const [showReprocessDialog, setShowReprocessDialog] = useState(false);

  // Check if we're in multi-video mode
  // (isMultiVideoMode is now provided by homeState.isMultiVideoMode)

  // Fetch and cache video properties
  const handleShowVideoProperties = async () => {
    setShowVideoProperties(true);
    fetchVideoProperties(videoPath);
  };


  // Sync project duration in multi-video mode
  useEffect(() => {
    if (isMultiVideoMode) {
      setDuration(getProjectDuration(timelineClips, timelineImages));
    }
  }, [timelineClips, timelineImages, isMultiVideoMode, setDuration]);

  // Load draft functionality
  const handleLoadDraft = async (draft: DraftItem) => {
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
        fetchDrafts(); // Refresh drafts list to update Recent Projects
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }, 5000); // 5 second debounce for auto-save

    return () => clearTimeout(timeoutId);
  }, [subtitles, videoPath, videoUrl, config, currentDraftId]);
  



  // Multi-video handlers
  const handleToggleVideoLibrary = () => setShowVideoLibrary(prev => !prev);
  
  const handleAddToTimeline = (clipId: string) => {
    const clip = videoClips.find(c => c.id === clipId);
    if (!clip) return;

    const newTimelineClip: TimelineClip = {
      id: uuidv4(),
      videoClipId: clipId,
      projectStartTime: duration, // Append at the end (sum of all clip durations)
      sourceInPoint: 0,
      clipDuration: clip.duration,
    };

    setTimelineClips(prev => [...prev, newTimelineClip]);
  };

  const handleRemoveClip = (clipId: string) => {
    const isUsed = timelineClips.some(c => c.videoClipId === clipId);
    if (isUsed && !confirm('This clip is used on the timeline. Removing it will also remove it from the timeline. Continue?')) {
      return;
    }

    setVideoClips(prev => prev.filter(c => c.id !== clipId));
    setTimelineClips(prev => prev.filter(c => c.videoClipId !== clipId));
  };

  const handleRelinkClip = async (clipId: string, file: File) => {
    const clip = videoClips.find(c => c.id === clipId);
    if (!clip) return;

    // 1. Validate file (strict check for now)
    // We allow different filename if user insists? For now stick to requirements.
    // Actually canRelinkClip checks filename/size.
    // If strict match fails, we might want to warn user.
    // For this MVP implementation, we'll try to match name. If not match, we'll ask confirmation.
    
    const isStrictMatch = canRelinkClip(clip, file.name, file.size);
    if (!isStrictMatch) {
       // Just a size/name warning, but we allow it if user really wants?
       // Requirement said "Allow re-upload with same filename/size"
       // We'll enforce it for now to be safe, or just log it.
       // Let's enforce name match at least to avoid accidents.
       if (clip.originalFilename !== file.name) {
          if (!confirm(`Filename mismatch. Original: ${clip.originalFilename}, New: ${file.name}. Continue relink?`)) return;
       }
    }

    setLoading(true);
    try {
      // 2. Upload file
      const formData = new FormData();
      formData.append("video", file);
      // We don't need to generate subtitles, just upload.
      // But /api/process generates subtitles.
      // We should probably add a flag to /api/process to SKIP generation if we just want upload?
      // Or use a lightweight upload.
      // For now, let's use /api/process but ignore the subtitles result.
      // Ideally we'd have an ?uploadOnly=true flag.
      formData.append("model", "gemini-2.5-flash"); // dummy
      
      const res = await fetch('/api/process', {
          method: 'POST',
          body: formData
      });
      
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      
      // 3. Update clip
      setVideoClips(prev => prev.map(c => {
         if (c.id === clipId) {
             return {
                 ...c,
                 filePath: data.videoPath,
                 fileSize: file.size,
                 missing: false // Clear missing flag
             };
         }
         return c;
      }));
      
      alert("Relink successful!");
    } catch (err: unknown) {
      console.error(err);
      alert(`Relink failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMultiVideoUpload = async (files: File[]) => {
    setLoading(true);
    const newClips: VideoClip[] = [];
    
    for (const f of files) {
      try {
        const formData = new FormData();
        formData.append("video", f);
        formData.append("secondaryLanguage", config.secondaryLanguage || "Simplified Chinese");
        formData.append("model", "gemini-2.5-flash");

        const res = await fetch('/api/process', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) throw new Error(`Upload failed for ${f.name}`);
        
        const data = await res.json();
        const infoRes = await fetch(`/api/video-info?path=${encodeURIComponent(data.videoPath)}`);
        const info = await infoRes.json();
        
        const clip: VideoClip = {
          id: uuidv4(),
          filePath: data.videoPath,
          originalFilename: f.name,
          duration: info.duration || 0,
          width: info.width || 0,
          height: info.height || 0,
          fileSize: f.size,
          subtitles: data.subtitles || [],
        };
        
        newClips.push(clip);
        
        if (!videoUrl && newClips.length === 1) {
          setVideoUrl(URL.createObjectURL(f));
          setVideoPath(data.videoPath);
          setSubtitles(data.subtitles || []);
          setDuration(info.duration || 0);
        }
      } catch (err) {
        console.error(`Error uploading ${f.name}:`, err);
      }
    }
    
    setVideoClips(prev => [...prev, ...newClips]);
    setShowVideoLibrary(true);
    setLoading(false);
    
    if (timelineClips.length === 0) {
      let currentStartTime = 0;
      const initialTimeline: TimelineClip[] = newClips.map(clip => {
        const tc: TimelineClip = {
          id: uuidv4(),
          videoClipId: clip.id,
          projectStartTime: currentStartTime,
          sourceInPoint: 0,
          clipDuration: clip.duration,
        };
        currentStartTime += clip.duration;
        return tc;
      });
      setTimelineClips(initialTimeline);
    }
  };


  const handleUploadComplete = async (rawSubtitles: RawSubtitleItem[], url: string, lang: string, serverPath: string, detectedLanguage?: string, originalFilename?: string, fileSize?: number) => {
    // Check if we can auto-repair a missing clip
    if (fileSize && originalFilename) {
       const missingClipIndex = videoClips.findIndex(c => c.missing && c.originalFilename === originalFilename && c.fileSize === fileSize);
       
       if (missingClipIndex !== -1) {
          // Found a match! Repair it.
          const repaired = [...videoClips];
          repaired[missingClipIndex] = {
             ...repaired[missingClipIndex],
             filePath: serverPath,
             missing: false
          };
          setVideoClips(repaired);
          
          // If this was the active video or the only video, restore state?
          // If multi-video, we just updated the library.
          // If single video (migrated to V2 structure or checking V1 via clips array if present)
          
          alert(`Successfully restored file for "${originalFilename}"`);
          return; // Skip new project creation
       }
    }

    const mapped: SubtitleLine[] = rawSubtitles.map(s => ({
      id: uuidv4(),
      startTime: parseTimestamp(s.startTime),
      endTime: parseTimestamp(s.endTime),
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
    
    // V2: Initialize clips if empty (Single Video Mode init)
    // If not in multi-video mode explicitly, we treat this as a fresh single project
    if (!uploadMode || uploadMode === 'single') {
       let width = 0;
       let height = 0;
       let dur = 0;
       
       try {
           const infoRes = await fetch(`/api/video-info?path=${encodeURIComponent(serverPath)}`);
           const info = await infoRes.json();
           width = info.width || 0;
           height = info.height || 0;
           dur = info.duration || 0;
           setDuration(dur); // Set main duration state
       } catch (err) {
           console.error("Failed to fetch video info on upload complete", err);
       }

       const newClip: VideoClip = {
          id: uuidv4(),
          filePath: serverPath,
          originalFilename: originalFilename || "Untitled",
          duration: dur,
          width: width,
          height: height,
          fileSize: fileSize,
          subtitles: mapped
       };
       setVideoClips([newClip]);
    }
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
  

  const handleExport = (format: 'ass' | 'srt' | 'srt-primary' | 'srt-secondary' | 'txt') => {
    let content = "";
    let fileName = "subtitles";
    let mimeType = "text/plain";

    if (format === 'ass') {
      content = generateAss(subtitles, config);
      fileName = 'project.ass';
    } else if (format === 'srt' || format === 'srt-primary') {
      content = generateSrtContent(subtitles, 'primary');
      fileName = 'subtitles_en.srt';
    } else if (format === 'srt-secondary') {
      content = generateSrtContent(subtitles, 'secondary');
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
        const processed = (data.subtitles as SubtitleLine[]).map((s) => ({
            ...s,
            id: s.id || uuidv4()
        }));
        setSubtitles(processed);
        resetHistory(processed);
    }
  };

  // Reprocess handler for the new ReprocessDialog
  const handleReprocessWithOptions = useCallback(async (options: ReprocessOptions): Promise<SubtitleLine[]> => {
    if (!videoPath) throw new Error("No video loaded");
    
    const response = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: videoPath,
        fileName: videoUrl?.split('/').pop() || "video.mp4",
        fileSize: 0,
        fileType: "video/mp4",
        model: options.model,
        secondaryLanguage: options.secondaryLanguage || "None",
        reprocess: true,
        primaryLanguage: config.primaryLanguage || "auto",
        existingFileUri: config.geminiFileUri,
        sampleDuration: options.sampleDuration,
        promptHints: options.promptHints,
      })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Reprocessing failed");
    }
    
    const data = await response.json();
    if (!data.subtitles) throw new Error("No subtitles returned");
    
    // Add unique IDs if missing
    const newSubtitles: SubtitleLine[] = (data.subtitles as SubtitleLine[]).map((s) => ({
      ...s,
      id: s.id || uuidv4()
    }));
    
    if (options.mode === 'merge' && subtitles.length > 0) {
      // Merge mode: keep existing timing, update text
      // Match by index (simple approach) or could match by time overlap
      const merged = subtitles.map((existing, idx) => {
        const newSub = newSubtitles[idx];
        if (newSub) {
          return {
            ...existing,
            text: newSub.text,
            secondaryText: newSub.secondaryText,
          };
        }
        return existing;
      });
      setSubtitles(merged);
      return merged;
    } else {
      // Replace mode
      setSubtitles(newSubtitles);
      return newSubtitles;
    }
  }, [videoPath, videoUrl, config.primaryLanguage, config.geminiFileUri, subtitles, setSubtitles]);

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

  // Consolidate reset logic
  const closeProject = useCallback(() => {
    console.log('[Page] Closing/Resetting project...');
    // Reset all core state
    setVideoUrl(null);
    setVideoPath(null);
    setDuration(0); // Reset duration
    setCurrentTime(0); // Reset time
    
    // Reset subtitles and history
    setSubtitles([]); 
    setInitialSubtitles(null);
    resetHistory([]);
    setSelectedSubtitleIds([]);
    
    // Reset config
    setConfig(DEFAULT_CONFIG);
    setCurrentDraftId(null);
    setPendingProjectFile(null); // Clear any pending restore
    
    // Reset multi-video state
    setVideoClips([]);
    setTimelineClips([]);
    setTimelineImages([]);
    setImageAssets([]);
    setProjectConfig(DEFAULT_PROJECT_CONFIG);
    setSelectedClipId(null);
    setSelectedImageId(null);
    
    console.log('[Page] Project reset complete');
  }, [
    setVideoUrl, setVideoPath, setDuration, setCurrentTime,
    setSubtitles, setInitialSubtitles, resetHistory, setSelectedSubtitleIds,
    setConfig, setCurrentDraftId, setPendingProjectFile,
    setVideoClips, setTimelineClips, setTimelineImages, setImageAssets,
    setProjectConfig, setSelectedClipId, setSelectedImageId
  ]);

  const handleCloseProject = async () => {
    // Just close the project. 
    // Auto-save handles draft persistence. 
    // User can delete drafts manually if desired.
    closeProject();
  };

  // === Clipboard Operations ===
  const handleCopySubtitles = useCallback(() => {
    if (selectedSubtitleIds.length === 0) return;
    const toCopy = subtitles.filter(s => selectedSubtitleIds.includes(s.id));
    setClipboardSubtitles(toCopy);
  }, [selectedSubtitleIds, subtitles]);

  const handleCutSubtitles = useCallback(() => {
    if (selectedSubtitleIds.length === 0) return;
    const toCopy = subtitles.filter(s => selectedSubtitleIds.includes(s.id));
    setClipboardSubtitles(toCopy);
    const remaining = subtitles.filter(s => !selectedSubtitleIds.includes(s.id));
    setSubtitles(remaining);
    setSelectedSubtitleIds([]);
  }, [selectedSubtitleIds, subtitles, setSubtitles]);

  const handlePasteSubtitles = useCallback(() => {
    if (clipboardSubtitles.length === 0) return;
    // Generate new IDs for pasted subtitles to avoid conflicts
    const pasted = clipboardSubtitles.map(s => ({
      ...s,
      id: `${s.id}-paste-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }));
    // Insert after last selected, or at end if none selected
    if (selectedSubtitleIds.length > 0) {
      const lastSelectedIndex = subtitles.findIndex(s => s.id === selectedSubtitleIds[selectedSubtitleIds.length - 1]);
      const newSubtitles = [
        ...subtitles.slice(0, lastSelectedIndex + 1),
        ...pasted,
        ...subtitles.slice(lastSelectedIndex + 1),
      ];
      setSubtitles(newSubtitles);
    } else {
      setSubtitles([...subtitles, ...pasted]);
    }
  }, [clipboardSubtitles, selectedSubtitleIds, subtitles, setSubtitles]);

  // === Merge/Split Operations ===
  const handleMergeSubtitles = useCallback(() => {
    if (selectedSubtitleIds.length < 2) return;
    const toMerge = subtitles.filter(s => selectedSubtitleIds.includes(s.id))
      .sort((a, b) => a.startTime - b.startTime);
    if (toMerge.length < 2) return;
    
    const merged = mergeSubtitles(toMerge);
    if (!merged) return;
    
    const mergedIds = new Set(toMerge.map(s => s.id));
    const newSubtitles = subtitles.filter(s => !mergedIds.has(s.id) || s.id === merged.id)
      .map(s => s.id === merged.id ? merged : s);
    setSubtitles(newSubtitles);
    setSelectedSubtitleIds([merged.id]);
  }, [selectedSubtitleIds, subtitles, setSubtitles]);

  const handleSplitSubtitle = useCallback(() => {
    if (selectedSubtitleIds.length !== 1) return;
    const toSplit = subtitles.find(s => s.id === selectedSubtitleIds[0]);
    if (!toSplit) return;
    
    const midTime = (toSplit.startTime + toSplit.endTime) / 2;
    const words = toSplit.text.split(' ');
    const midWord = Math.floor(words.length / 2);
    
    const first: SubtitleLine = {
      id: toSplit.id,
      startTime: toSplit.startTime,
      endTime: midTime,
      text: words.slice(0, midWord).join(' ') || toSplit.text,
      secondaryText: toSplit.secondaryText,
    };
    
    const second: SubtitleLine = {
      id: `${toSplit.id}-split-${Date.now()}`,
      startTime: midTime,
      endTime: toSplit.endTime,
      text: words.slice(midWord).join(' ') || '...',
      secondaryText: undefined,
    };
    
    const idx = subtitles.findIndex(s => s.id === toSplit.id);
    const newSubtitles = [
      ...subtitles.slice(0, idx),
      first,
      second,
      ...subtitles.slice(idx + 1),
    ];
    setSubtitles(newSubtitles);
    setSelectedSubtitleIds([first.id, second.id]);
  }, [selectedSubtitleIds, subtitles, setSubtitles]);

  // Keyboard shortcuts for Undo/Redo & New Project
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
      
      // New Project (Shift+N)
      if (e.shiftKey && (e.key === 'N' || e.key === 'n')) {
         e.preventDefault();
         closeProject();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, closeProject]);

  // Handle subtitle selection with Shift+click range selection
  const handleSubtitleSelect = (id: string, shiftKey: boolean, ctrlKey: boolean) => {
    if (id === "") {
      setSelectedSubtitleIds([]);
      return;
    }
    if (shiftKey && lastSelectedIdRef.current) {
      // Range selection
      const lastIndex = subtitles.findIndex(s => s.id === lastSelectedIdRef.current);
      const currentIndex = subtitles.findIndex(s => s.id === id);
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const rangeIds = getRangeSelectionIds(subtitles, lastSelectedIdRef.current, id);
        
        if (ctrlKey) {
          // Add range to existing selection
          setSelectedSubtitleIds(prev => Array.from(new Set([...prev, ...rangeIds])));
        } else {
          // Replace selection with range
          setSelectedSubtitleIds(rangeIds);
        }
        return;
      }
    }
    
    if (ctrlKey) {
      // Toggle single selection
      setSelectedSubtitleIds(prev => {
        if (prev.includes(id)) {
          return prev.filter(i => i !== id);
        } else {
          lastSelectedIdRef.current = id;
          return [...prev, id];
        }
      });
    } else {
      // Select single (reset others)
      lastSelectedIdRef.current = id;
      setSelectedSubtitleIds([id]);
    }
  };

  // === Find & Replace Logic ===
  const findResultsRef = useRef<FindResult[]>([]);
  const currentResultIndexRef = useRef<number>(-1);

  const handleFind = (query: string, options: FindOptions): FindResult | null => {
    findResultsRef.current = [];
    currentResultIndexRef.current = -1;
    
    if (!query) return null;

    const results: FindResult[] = [];
    const lowerQuery = options.caseSensitive ? query : query.toLowerCase();

    subtitles.forEach((sub, index) => {
      // Check Primary
      if (options.searchPrimary && sub.text) {
        const text = options.caseSensitive ? sub.text : sub.text.toLowerCase();
        if (text.includes(lowerQuery)) {
          results.push({ subtitleId: sub.id, field: 'primary', index: -1, total: -1 }); // index/total set later
        }
      }
      // Check Secondary
      if (options.searchSecondary && sub.secondaryText) {
        const text = options.caseSensitive ? sub.secondaryText : sub.secondaryText.toLowerCase();
        if (text.includes(lowerQuery)) {
          results.push({ subtitleId: sub.id, field: 'secondary', index: -1, total: -1 });
        }
      }
    });

    if (results.length === 0) return null;

    // Assign indices
    results.forEach((r, i) => {
       r.index = i;
       r.total = results.length;
    });

    findResultsRef.current = results;
    currentResultIndexRef.current = 0;
    
    // Jump to first result
    const first = results[0];
    const sub = subtitles.find(s => s.id === first.subtitleId);
    if (sub) {
       setCurrentTime(sub.startTime);
       setSelectedSubtitleIds([sub.id]);
    }
    
    return first;
  };

  const handleFindNext = (): FindResult | null => {
      if (findResultsRef.current.length === 0) return null;
      let nextIndex = currentResultIndexRef.current + 1;
      if (nextIndex >= findResultsRef.current.length) nextIndex = 0; // Wrap around
      
      currentResultIndexRef.current = nextIndex;
      const res = findResultsRef.current[nextIndex];
      
      const sub = subtitles.find(s => s.id === res.subtitleId);
      if (sub) {
         setCurrentTime(sub.startTime);
         setSelectedSubtitleIds([sub.id]);
      }
      return res;
  };

  const handleFindPrevious = (): FindResult | null => {
      if (findResultsRef.current.length === 0) return null;
      let prevIndex = currentResultIndexRef.current - 1;
      if (prevIndex < 0) prevIndex = findResultsRef.current.length - 1; // Wrap around
      
      currentResultIndexRef.current = prevIndex;
      const res = findResultsRef.current[prevIndex];
      
      const sub = subtitles.find(s => s.id === res.subtitleId);
      if (sub) {
         setCurrentTime(sub.startTime);
         setSelectedSubtitleIds([sub.id]);
      }
      return res;
  };

  const handleReplace = (query: string, replacement: string, options: FindOptions): number => {
      // Replace current match if any, otherwise find next and replace?
      // Standard behavior: if current selection matches, replace it. Else find next and replace it.
      // For simplicity here, we'll try to find one match starting from current position/time?
      // Or just use the current result from findResultsRef if valid?
      
      if (findResultsRef.current.length === 0) {
          // Try to find first
          const found = handleFind(query, options);
          if (!found) return 0;
      }
      
      const currentRes = findResultsRef.current[currentResultIndexRef.current];
      if (!currentRes) return 0;
      
      const subIndex = subtitles.findIndex(s => s.id === currentRes.subtitleId);
      if (subIndex === -1) return 0;
      
      const sub = subtitles[subIndex];
      const flags = options.caseSensitive ? 'g' : 'gi';
      // Note: simple string replace might replace multiple occurrences in the same line if 'g' used
      // Use 'g' since we matched the line.
      
      let newText = sub.text;
      let newSecondary = sub.secondaryText;
      let replaced = false;

      if (currentRes.field === 'primary' && options.searchPrimary) {
          const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags); // escape regex chars
          const updated = newText.replace(regex, replacement);
          if (updated !== newText) {
              newText = updated;
              replaced = true;
          }
      } else if (currentRes.field === 'secondary' && options.searchSecondary && newSecondary) {
           const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
           const updated = newSecondary.replace(regex, replacement);
           if (updated !== newSecondary) {
               newSecondary = updated;
               replaced = true;
           }
      }
      
      if (replaced) {
          const newSubtitles = [...subtitles];
          newSubtitles[subIndex] = { ...sub, text: newText, secondaryText: newSecondary };
          setSubtitles(newSubtitles);
          
          // Re-run find to update results list since state changed
          // This is a bit expensive but accurate.
          // Or just update the current result?
          // Let's re-run find to keep it synced.
          handleFind(query, options); 
          return 1;
      }

      return 0;
  };

  const handleReplaceAll = (query: string, replacement: string, options: FindOptions): number => {
      const flags = options.caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      let count = 0;
      
      const newSubtitles = subtitles.map(sub => {
          let text = sub.text;
          let secondaryText = sub.secondaryText;
          let changed = false;
          
          if (options.searchPrimary && text) {
             const updated = text.replace(regex, replacement);
             if (updated !== text) {
                 text = updated;
                 // count += (text.match(regex) || []).length; // approximation
                 count++; // count lines changed or occurrences? UI usually shows occurrences.
                 changed = true;
             }
          }
          
          if (options.searchSecondary && secondaryText) {
             const updated = secondaryText.replace(regex, replacement);
             if (updated !== secondaryText) {
                 secondaryText = updated;
                 count++;
                 changed = true;
             }
          }
          
          return changed ? { ...sub, text, secondaryText } : sub;
      });
      
      if (count > 0) {
          setSubtitles(newSubtitles);
          // Clear find results as they are stale
          findResultsRef.current = [];
          currentResultIndexRef.current = -1;
      }
      
      return count;
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
            onGlobalSettings={() => {
              setGlobalSettingsTab('styles');
              setShowGlobalSettings(true);
            }}
            onThemeSettings={() => {
              setGlobalSettingsTab('appearance');
              setShowGlobalSettings(true);
            }}
            onShowShortcuts={() => setShowShortcuts(true)}
            onAbout={() => setShowAbout(true)}
            recentDrafts={drafts.slice(0, 10).map(d => ({
              id: d.id,
              name: d.name,
              date: d.updatedAt
            }))}
            onLoadDraft={(id) => {
              const draft = drafts.find(d => d.id === id);
              if (draft) handleLoadDraft(draft);
            }}
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
            drafts={drafts}
            loading={draftsLoading}
            onLoadDraft={handleLoadDraft}
            onDelete={(id) => {
              handleDeleteDraft(id);
              if (currentDraftId === id) {
                console.log("Deleted active project, closing editor...");
                closeProject();
              }
            }}
          />

          {/* Main Upload Area - Center */}
          <div className="flex-1 flex flex-col items-center justify-center p-2 overflow-auto">
          <div className="w-full max-w-lg lg:max-w-2xl xl:max-w-3xl border border-[#333333] bg-[#252526] shadow-xl">
            <div className="h-8 bg-[#333333] flex items-center px-3 text-xs font-semibold text-[#cccccc] select-none">
              SubtitleGem - New Project
            </div>
            <div className="p-5 flex flex-col items-center">
              <div className="mb-4 p-3 bg-[#1e1e1e] border border-[#333333]">
                <FileVideo className="w-10 h-10 text-[#555555]" />
              </div>
              <h1 className="text-xl font-medium text-[#e1e1e1] mb-1">Welcome to SubtitleGem</h1>
              <p className="text-sm text-[#888888] mb-5 text-center">Start by importing a video file to generate subtitles.</p>
              <VideoUpload 
                onUploadComplete={handleUploadComplete} 
                pendingProjectFile={pendingProjectFile}
                uploadMode={uploadMode}
                onUploadModeChange={setUploadMode}
                onMultiVideoUpload={handleMultiVideoUpload}
                isProcessing={loading}
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
          onRetry={async (id: string) => {
            await fetch('/api/queue', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'retry', id })
            });
            // Immediate re-fetch
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
          initialTab={globalSettingsTab}
        />
        
        <KeyboardShortcutsDialog
          isOpen={showShortcuts}
          onClose={() => setShowShortcuts(false)}
        />

        <AboutDialog
          isOpen={showAbout}
          onClose={() => setShowAbout(false)}
        />

        <ReprocessDialog
          isOpen={showReprocessDialog}
          onClose={() => setShowReprocessDialog(false)}
          subtitleCount={subtitles.length}
          currentModel={config.geminiModel || "gemini-2.5-flash"}
          currentSecondaryLanguage={config.secondaryLanguage || ""}
          onReprocess={handleReprocessWithOptions}
          videoPath={videoPath}
        />
        
        <ShiftTimingsDialog
          isOpen={showShiftTimings}
          onClose={() => setShowShiftTimings(false)}
          subtitleCount={subtitles.length}
          onShift={(offsetMs) => {
            const shifted = subtitles.map(s => ({
              ...s,
              startTime: Math.max(0, s.startTime + offsetMs),
              endTime: Math.max(0, s.endTime + offsetMs),
            }));
            setSubtitles(shifted);
          }}
        />
        
        <FindReplaceDialog
          isOpen={showFindReplace}
          onClose={() => setShowFindReplace(false)}
          onFind={(query, options) => {
            // TODO: Implement find logic
            return null;
          }}
          onReplace={(query, replacement, options) => {
            // Simple replace implementation
            let count = 0;
            const updated = subtitles.map(s => {
              let modified = { ...s };
              if (options.searchPrimary && s.text.includes(query)) {
                modified.text = s.text.replace(query, replacement);
                count++;
              }
              if (options.searchSecondary && s.secondaryText?.includes(query)) {
                modified.secondaryText = s.secondaryText.replace(query, replacement);
                count++;
              }
              return modified;
            });
            if (count > 0) setSubtitles(updated);
            return count;
          }}
          onReplaceAll={(query, replacement, options) => {
            let count = 0;
            const regex = new RegExp(options.caseSensitive ? query : query, options.caseSensitive ? 'g' : 'gi');
            const updated = subtitles.map(s => {
              let modified = { ...s };
              if (options.searchPrimary) {
                const matches = s.text.match(regex);
                if (matches) {
                  count += matches.length;
                  modified.text = s.text.replace(regex, replacement);
                }
              }
              if (options.searchSecondary && s.secondaryText) {
                const matches = s.secondaryText.match(regex);
                if (matches) {
                  count += matches.length;
                  modified.secondaryText = s.secondaryText.replace(regex, replacement);
                }
              }
              return modified;
            });
            if (count > 0) setSubtitles(updated);
            return count;
          }}
          onFindNext={() => null}
          onFindPrevious={() => null}
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
            projectConfig={projectConfig}
            onUpdateProjectConfig={(updates) => setProjectConfig(prev => ({ ...prev, ...updates }))}
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
            onNewProject={closeProject}
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
            onReprocessVideo={() => setShowReprocessDialog(true)}
            onGlobalSettings={() => {
              setGlobalSettingsTab('styles');
              setShowGlobalSettings(true);
            }}
            onThemeSettings={() => {
              setGlobalSettingsTab('appearance');
              setShowGlobalSettings(true);
            }}
            onVideoProperties={handleShowVideoProperties}
            onToggleVideoLibrary={handleToggleVideoLibrary}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onShowShortcuts={() => setShowShortcuts(true)}
            onAbout={() => setShowAbout(true)}
            onFindReplace={() => setShowFindReplace(true)}
            onShiftTimings={() => setShowShiftTimings(true)}
            onCut={handleCutSubtitles}
            onCopy={handleCopySubtitles}
            onPaste={handlePasteSubtitles}
            onMerge={handleMergeSubtitles}
            onSplit={handleSplitSubtitle}
            hasSelection={selectedSubtitleIds.length > 0}
            hasClipboard={clipboardSubtitles.length > 0}
            canMerge={selectedSubtitleIds.length >= 2}
            canSplit={selectedSubtitleIds.length === 1}
            onZoomIn={() => timelineRef.current?.zoomIn()}
            onZoomOut={() => timelineRef.current?.zoomOut()}
            recentDrafts={drafts.slice(0, 10).map(d => ({
              id: d.id,
              name: d.name,
              date: d.updatedAt
            }))}
            onLoadDraft={(id) => {
              const draft = drafts.find(d => d.id === id);
              if (draft) handleLoadDraft(draft);
            }}
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
          
          {/* Raw Editor button removed */}
          
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
        
        {/* VIDEO LIBRARY SIDEBAR - Multi-video mode */}
        {showVideoLibrary && (
          <VideoLibrary
            clips={videoClips}
            timelineClips={timelineClips}
            onAddToTimeline={handleAddToTimeline}
            onRemoveClip={handleRemoveClip}
            onRelinkClip={handleRelinkClip}
            onClipSelect={setSelectedClipId}
            selectedClipId={selectedClipId}
            isCollapsed={isLibraryCollapsed}
            onToggleCollapse={() => setIsLibraryCollapsed(!isLibraryCollapsed)}
          />
        )}
        
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
                  timelineClips={timelineClips}
                  videoClips={videoClips}
                  timelineImages={timelineImages}
                  imageAssets={imageAssets}
                  projectConfig={projectConfig}
                  config={config} 
                  currentTime={currentTime}
                  onTimeUpdate={setCurrentTime}
                  onDurationChange={setDuration}
                  videoProperties={videoProperties}
                />
            </div>
          </div>

          {/* Timeline Area - Smaller on mobile */}
          <div className="h-40 lg:h-48 2xl:h-64 border-t border-[#333333] bg-[#252526] flex flex-col shrink-0">
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
                  ref={timelineRef}
                  subtitles={subtitles} 
                  duration={duration} 
                  onSubtitlesUpdate={setSubtitles}
                  currentTime={currentTime}
                  onSeek={setCurrentTime}
                  selectedIds={selectedSubtitleIds}
                  onSelect={handleSubtitleSelect}
                  onSplit={splitSubtitle}
                  // Multi-video props
                  videoClips={isMultiVideoMode ? videoClips : undefined}
                  timelineClips={isMultiVideoMode ? timelineClips : undefined}
                  onTimelineClipsUpdate={isMultiVideoMode ? setTimelineClips : undefined}
                  selectedClipId={selectedClipId}
                  onClipSelect={setSelectedClipId}
                  
                  // Image props
                  imageAssets={imageAssets}
                  timelineImages={timelineImages}
                  onTimelineImagesUpdate={setTimelineImages}
                  selectedImageId={selectedImageId}
                  onImageSelect={setSelectedImageId}
                  
                  // Context Menu actions
                  onDuplicateClip={(id, type) => {
                    if (type === 'video') {
                      const clip = timelineClips.find(c => c.id === id);
                      if (clip) {
                        const newClip = { ...clip, id: uuidv4(), projectStartTime: clip.projectStartTime + clip.clipDuration };
                        setTimelineClips([...timelineClips, newClip]);
                      }
                    } else {
                      const img = timelineImages.find(i => i.id === id);
                      if (img) {
                        const newImg = { ...img, id: uuidv4(), projectStartTime: img.projectStartTime + img.duration };
                        setTimelineImages([...timelineImages, newImg]);
                      }
                    }
                  }}
                  onSplitClip={(id, time) => {
                    const index = timelineClips.findIndex(c => c.id === id);
                    if (index === -1) return;
                    const clip = timelineClips[index];
                    
                    // Calculate split point relative to clip start
                    const relativeSplitTime = time - clip.projectStartTime;
                    if (relativeSplitTime <= 0.5 || relativeSplitTime >= clip.clipDuration - 0.5) return;
                    
                    const firstPart: TimelineClip = {
                      ...clip,
                      clipDuration: relativeSplitTime
                    };
                    const secondPart: TimelineClip = {
                      ...clip,
                      id: uuidv4(),
                      projectStartTime: time,
                      sourceInPoint: clip.sourceInPoint + relativeSplitTime,
                      clipDuration: clip.clipDuration - relativeSplitTime
                    };
                    
                    const newClips = [...timelineClips];
                    newClips.splice(index, 1, firstPart, secondPart);
                    setTimelineClips(newClips);
                  }}
                  onRemoveTimelineItem={(id, type) => {
                    if (type === 'video') {
                      setTimelineClips(timelineClips.filter(c => c.id !== id));
                    } else {
                      setTimelineImages(timelineImages.filter(i => i.id !== id));
                    }
                  }}
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
                videoMetaData={
                    videoClips.length > 0 ? {
                        width: videoClips[0].width,
                        height: videoClips[0].height,
                        duration: videoClips[0].duration || duration
                    } : undefined
                }
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
                        draftId: currentDraftId || undefined,
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
          onRetry={async (id: string) => {
            await fetch('/api/queue', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'retry', id })
            });
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

      {/* Raw Editor removed */}
      
      {/* Raw Editor removed */}
      
      <FindReplaceDialog
        isOpen={showFindReplace}
        onClose={() => setShowFindReplace(false)}
        onFind={handleFind}
        onFindNext={handleFindNext}
        onFindPrevious={handleFindPrevious}
        onReplace={handleReplace}
        onReplaceAll={handleReplaceAll}
      />

      <ProjectSettingsDialog
        isOpen={showProjectSettings}
        onClose={() => setShowProjectSettings(false)}
        config={config}
        onUpdateConfig={(updates) => setConfig(prev => ({ ...prev, ...updates }))}
        projectConfig={projectConfig}
        onUpdateProjectConfig={(updates) => setProjectConfig(prev => ({ ...prev, ...updates }))}
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