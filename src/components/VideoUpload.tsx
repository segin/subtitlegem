"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileVideo, AlertCircle, Film, Cpu, Languages, Loader2, Zap, Check, X, FolderPlus, Files, Layers, Plus, Minus, GripVertical, Trash2, ArrowUpFromLine, Lock, FileText } from "lucide-react";
import { validateVideoFile, prepareUploadFormData, generateClipId } from "@/lib/upload-utils";
import { cacheModelResult, checkModelAvailability } from "@/lib/model-cache";

// Upload modes for multi-video support
export type UploadMode = 
  | 'single'           // Single video, single project (default/legacy)
  | 'multi-video'      // Multiple videos → single project (Mode 1)
  | 'batch'            // Multiple videos → separate projects (Mode 2)
  | 'advanced';        // Advanced: custom assignment (Mode 3)

export interface StagedProject {
  id: string;
  files: File[];
  isDragging: boolean;
}

interface VideoUploadProps {
  onUploadComplete: (subtitles: any[], videoUrl: string, lang: string, serverPath: string, detectedLanguage?: string, originalFilename?: string, fileSize?: number) => void;
  pendingProjectFile?: File | null;
  // Multi-video support
  uploadMode?: UploadMode;
  onUploadModeChange?: (mode: UploadMode) => void;
  onMultiVideoUpload?: (files: File[]) => void;
}

export function VideoUpload({ 
  onUploadComplete, 
  pendingProjectFile,
  uploadMode = 'single',
  onUploadModeChange,
  onMultiVideoUpload,
}: VideoUploadProps) {

  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]); // For multi-file modes
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondaryLanguage, setSecondaryLanguage] = useState("Simplified Chinese");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [isDragging, setIsDragging] = useState(false);
  
  const [progress, setProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);

  // Advanced Mode State (Mode 3)
  const [advancedProjects, setAdvancedProjects] = useState<StagedProject[]>([
    { id: generateClipId(), files: [], isDragging: false }
  ]);

  // Drag reorder state
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null);
  const [dragProjectId, setDragProjectId] = useState<string | null>(null);
  // External drop insertion state  
  const [insertProjectId, setInsertProjectId] = useState<string | null>(null);
  const [insertIndex, setInsertIndex] = useState<number | null>(null); // null = append, number = insert before
  
  // Model Data & Global Selection State
  const [availableModels, setAvailableModels] = useState<{name: string; displayName: string}[]>([]);
  const [testing, setTesting] = useState(false); // Global testing state for main UI
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);

  // Modal Specific State
  const [showModelChooser, setShowModelChooser] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [selectedInModal, setSelectedInModal] = useState<string | null>(null);
  const [modalTestResult, setModalTestResult] = useState<{success: boolean; message: string} | null>(null);
  const [modalTesting, setModalTesting] = useState(false);
  const [testedModels, setTestedModels] = useState<Record<string, {success: boolean}>>({});

  const startTimeRef = useRef<number>(0);
  const dragCounterRef = useRef(0);

  // Fetch available models from API
  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      if (data.models) {
        setAvailableModels(data.models);
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setLoadingModels(false);
    }
  };

  // Test current model (Main UI)
  const testModel = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const success = await checkModelAvailability(model, true); // true = bypass cache for explicit test
      setTestResult({
        success,
        message: success ? 'Model OK!' : 'Model validation failed'
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Test failed'
      });
    } finally {
      setTesting(false);
    }
  };

  // Test model in modal
  const testModelInModal = async () => {
    if (!selectedInModal) return;
    setModalTesting(true);
    setModalTestResult(null);
    try {
      const success = await checkModelAvailability(selectedInModal, true); // bypass cache for manual test
      setModalTestResult({
        success,
        message: success ? 'Model OK!' : 'Model validation failed'
      });
      // Track persistent result
      setTestedModels(prev => ({
        ...prev,
        [selectedInModal]: { success }
      }));
    } catch (err: any) {
      const errorMsg = err.message || 'Test failed';
      setModalTestResult({
        success: false,
        message: errorMsg
      });
      setTestedModels(prev => ({
        ...prev,
        [selectedInModal]: { success: false }
      }));
    } finally {
      setModalTesting(false);
    }
  };

  // Open model chooser
  const openModelChooser = async () => {
    setSelectedInModal(model);
    setModalTestResult(null);
    setTestedModels({}); // Reset test results for new session
    setShowModelChooser(true);
    if (availableModels.length === 0) {
      await fetchModels();
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleFileSelect = useCallback((selectedFile: File) => {
    const result = validateVideoFile(selectedFile);
    if (result.valid) {
      setFile(selectedFile);
      setError(null);
      setProgress(0);
    } else {
      setError(result.error || 'Invalid video file');
    }
  }, []);

  // Multi-file select for Mode 1/2
  const handleMultiFileSelect = useCallback((selectedFiles: FileList | File[]) => {
    const allFiles = Array.from(selectedFiles);
    const videoFiles = allFiles.filter(f => f.type.startsWith('video/'));
    const projectFiles = allFiles.filter(f => f.name.endsWith('.sgproj'));
    
    // .sgproj files go first (locked as primary for restore mode)
    const orderedFiles = [...projectFiles, ...videoFiles];
    
    if (orderedFiles.length === 0) {
      setError('No valid video or project files found');
      return;
    }
    
    setFiles(prev => {
      // If adding a .sgproj, remove any existing ones first (only one per project in batch mode)
      // In multi-video mode, only allow one .sgproj total
      if (projectFiles.length > 0) {
        const existingProjects = prev.filter(f => f.name.endsWith('.sgproj'));
        const existingVideos = prev.filter(f => !f.name.endsWith('.sgproj'));
        // Place new .sgproj first, then existing videos, then new videos
        return [...projectFiles.slice(0, 1), ...existingVideos, ...videoFiles];
      }
      return [...prev, ...orderedFiles];
    });
    setError(null);
  }, []);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (uploadMode === 'multi-video' || uploadMode === 'batch') {
        handleMultiFileSelect(e.target.files);
      } else {
        handleFileSelect(e.target.files[0]);
      }
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (uploadMode === 'multi-video' || uploadMode === 'batch') {
        handleMultiFileSelect(e.dataTransfer.files);
      } else {
        handleFileSelect(e.dataTransfer.files[0]);
      }
      e.dataTransfer.clearData();
    }
  }, [handleFileSelect, handleMultiFileSelect, uploadMode]);

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setProgress(0);
    setUploadedBytes(0);
    setTotalBytes(file.size);
    setUploadSpeed(0);

    const formData = prepareUploadFormData(file, {
      secondaryLanguage: secondaryLanguage !== 'None' ? secondaryLanguage : undefined,
      model,
    });

    const xhr = new XMLHttpRequest();
    startTimeRef.current = Date.now();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const now = Date.now();
        const timeDiff = (now - startTimeRef.current) / 1000;
        if (timeDiff > 0) setUploadSpeed(event.loaded / timeDiff);
        setProgress(Math.round((event.loaded / event.total) * 100));
        setUploadedBytes(event.loaded);
        setTotalBytes(event.total);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.error) setError(data.error);
          else {
            // If a pending project file exists, parse and use its subtitles
            if (pendingProjectFile) {
              const reader = new FileReader();
              reader.onload = (e) => {
                try {
                  const projectData = JSON.parse(e.target?.result as string);
                  onUploadComplete(
                    projectData.subtitles || data.subtitles,
                    URL.createObjectURL(file),
                    secondaryLanguage,
                    data.videoPath,
                    data.detectedLanguage,
                    data.originalFilename,
                    data.fileSize
                  );
                } catch {
                  // Fall back to generated subtitles
                  onUploadComplete(
                    data.subtitles,
                    URL.createObjectURL(file),
                    secondaryLanguage,
                    data.videoPath,
                    data.detectedLanguage,
                    data.originalFilename,
                    data.fileSize
                  );
                }
              };
              reader.readAsText(pendingProjectFile);
            } else {
              onUploadComplete(
                data.subtitles, 
                URL.createObjectURL(file), 
                secondaryLanguage, 
                data.videoPath,
                data.detectedLanguage,
                data.originalFilename,
                data.fileSize
              );
            }
          }
        } catch (e) { setError("Failed to parse response"); }
      } else if (xhr.status === 429) {
        setError("Rate limit exceeded. Please wait.");
      } else {
         setError(`Upload failed: ${xhr.statusText}`);
      }
      setLoading(false);
    });

    xhr.addEventListener("error", () => {
      setError("Network error");
      setLoading(false);
    });

    xhr.open("POST", "/api/process");
    xhr.send(formData);
  };

  return (
    <div className="w-full bg-[#252526] p-4 text-[#cccccc]">
      <input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
        id="video-input"
        disabled={loading}
      />
      
      {/* Model and Language Selection - Always visible */}
      <div className="space-y-3 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-[#666666] tracking-wider">AI Model</label>
            <div className="flex gap-2">
              <select
                value={model}
                onChange={(e) => {
                  if (e.target.value === '...') {
                    openModelChooser();
                  } else {
                    setModel(e.target.value);
                    setTestResult(null);
                  }
                }}
                disabled={loading}
                className="flex-1 bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-xs p-2 focus:border-[#007acc] outline-none rounded-sm"
              >
                <option value="gemini-3-flash-preview">Gemini 3 Flash (Preview)</option>
                <option value="gemini-3-pro-preview">Gemini 3 Pro (Preview)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                {/* Show current model if it's not in the main list */}
                {!['gemini-3-flash-preview','gemini-3-pro-preview','gemini-2.5-flash','gemini-2.5-pro'].includes(model) && (
                  <option value={model}>{model}</option>
                )}
                <option value="...">... (Choose other model)</option>
              </select>
              <button
                type="button"
                onClick={testModel}
                disabled={testing || loading}
                className="px-2 py-1 bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 text-white text-xs rounded-sm transition-colors flex items-center gap-1 min-w-[60px] justify-center"
                title="Test model"
              >
                {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                <span>{testing ? "..." : "Zap"}</span>
              </button>
            </div>
            {testResult && (
              <div className={`flex items-center gap-1 text-[10px] mt-1 ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.success ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-[#666666] tracking-wider">Secondary Language</label>
            <select
              value={secondaryLanguage}
              onChange={(e) => setSecondaryLanguage(e.target.value)}
              disabled={loading}
              className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-xs p-2 focus:border-[#007acc] outline-none rounded-sm"
            >
              <option value="None">None</option>
              <option value="English">English</option>
              <option value="Simplified Chinese">Simplified Chinese</option>
              <option value="Traditional Chinese">Traditional Chinese</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Italian">Italian</option>
              <option value="Portuguese">Portuguese</option>
              <option value="Dutch">Dutch</option>
              <option value="Polish">Polish</option>
              <option value="Russian">Russian</option>
              <option value="Japanese">Japanese</option>
              <option value="Korean">Korean</option>
              <option value="Arabic">Arabic</option>
              <option value="Turkish">Turkish</option>
              <option value="Swedish">Swedish</option>
              <option value="Danish">Danish</option>
              <option value="Norwegian">Norwegian</option>
              <option value="Finnish">Finnish</option>
              <option value="Greek">Greek</option>
              <option value="Czech">Czech</option>
              <option value="Hungarian">Hungarian</option>
              <option value="Romanian">Romanian</option>
              <option value="Ukrainian">Ukrainian</option>
            </select>
          </div>
        </div>
      </div>

      {/* Upload Mode Selector */}
      {onUploadModeChange && (
        <div className="mb-4">
          <label className="text-[10px] uppercase font-bold text-[#666666] tracking-wider block mb-2">Upload Mode</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => onUploadModeChange('single')}
              disabled={loading}
              className={`p-2 rounded-md border transition-all text-left ${
                uploadMode === 'single'
                  ? 'bg-[#264f78] border-[#007acc] text-white'
                  : 'bg-[#2d2d2d] border-[#3e3e42] text-[#888888] hover:border-[#555555] hover:text-[#cccccc]'
              }`}
            >
              <FileVideo className="w-4 h-4 mb-1" />
              <div className="text-[10px] font-medium">Single</div>
              <div className="text-[8px] opacity-60">1 video → 1 project</div>
            </button>
            <button
              type="button"
              onClick={() => onUploadModeChange('multi-video')}
              disabled={loading}
              className={`p-2 rounded-md border transition-all text-left ${
                uploadMode === 'multi-video'
                  ? 'bg-[#264f78] border-[#007acc] text-white'
                  : 'bg-[#2d2d2d] border-[#3e3e42] text-[#888888] hover:border-[#555555] hover:text-[#cccccc]'
              }`}
            >
              <FolderPlus className="w-4 h-4 mb-1" />
              <div className="text-[10px] font-medium">Multi-Video</div>
              <div className="text-[8px] opacity-60">N videos → 1 project</div>
            </button>
            <button
              type="button"
              onClick={() => onUploadModeChange('batch')}
              disabled={loading}
              className={`p-2 rounded-md border transition-all text-left ${
                uploadMode === 'batch'
                  ? 'bg-[#264f78] border-[#007acc] text-white'
                  : 'bg-[#2d2d2d] border-[#3e3e42] text-[#888888] hover:border-[#555555] hover:text-[#cccccc]'
              }`}
            >
              <Files className="w-4 h-4 mb-1" />
              <div className="text-[10px] font-medium">Batch</div>
              <div className="text-[8px] opacity-60">N videos → N projects</div>
            </button>
            <button
              type="button"
              onClick={() => onUploadModeChange('advanced')}
              disabled={loading}
              className={`p-2 rounded-md border transition-all text-left ${
                uploadMode === 'advanced'
                  ? 'bg-[#264f78] border-[#007acc] text-white'
                  : 'bg-[#2d2d2d] border-[#3e3e42] text-[#888888] hover:border-[#555555] hover:text-[#cccccc]'
              }`}
            >
              <Layers className="w-4 h-4 mb-1" />
              <div className="text-[10px] font-medium">Advanced</div>
              <div className="text-[8px] opacity-60">Custom assignment</div>
            </button>
          </div>
        </div>
      )}

      {/* Advanced Mode (Mode 3) */}
      {uploadMode === 'advanced' ? (
        <div className="space-y-4">
          {/* Add Project Button - Top Left */}
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => {
                setAdvancedProjects(prev => [...prev, {
                  id: generateClipId(),
                  files: [],
                  isDragging: false
                }]);
              }}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d2d2d] border border-[#3e3e42] text-[#cccccc] text-xs rounded-sm hover:bg-[#3e3e42] hover:border-[#555555] transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Project</span>
            </button>
          </div>

          {/* Main Projects Container */}
          <div className="bg-[#1e1e1e] border border-[#333333] rounded-md overflow-hidden">
            {advancedProjects.map((project, projectIndex) => (
              <div 
                key={project.id}
                className={`${projectIndex > 0 ? 'border-t border-[#333333]' : ''}`}
              >
                {/* Project Section Header */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526]">
                  <div className="flex items-center gap-2">
                    {/* Add Files Button */}
                    <label className="flex items-center gap-1 px-2 py-1 bg-[#2d2d2d] border border-[#3e3e42] text-[#888888] text-[10px] rounded-sm hover:bg-[#3e3e42] hover:text-[#cccccc] cursor-pointer transition-colors">
                      <Plus className="w-3 h-3" />
                      <span>Add Files</span>
                      <input
                        type="file"
                        accept="video/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) {
                            const newFiles = Array.from(e.target.files).filter(f => f.type.startsWith('video/'));
                            setAdvancedProjects(prev => prev.map(p => 
                              p.id === project.id 
                                ? { ...p, files: [...p.files, ...newFiles] }
                                : p
                            ));
                          }
                        }}
                      />
                    </label>
                    <span className="text-[10px] text-[#555555]">
                      {project.files.length} file{project.files.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* Remove Project Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (advancedProjects.length > 1) {
                        setAdvancedProjects(prev => prev.filter(p => p.id !== project.id));
                      }
                    }}
                    disabled={advancedProjects.length <= 1}
                    className="p-1 text-[#666666] hover:text-[#f44336] disabled:opacity-30 disabled:hover:text-[#666666] transition-colors"
                    title={advancedProjects.length <= 1 ? "Cannot remove the only project" : "Remove project"}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>

                {/* File Drop Zone */}
                <div
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setAdvancedProjects(prev => prev.map(p => 
                      p.id === project.id ? { ...p, isDragging: true } : { ...p, isDragging: false }
                    ));
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Only unset if leaving the whole zone
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX, y = e.clientY;
                    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                      setAdvancedProjects(prev => prev.map(p => 
                        p.id === project.id ? { ...p, isDragging: false } : p
                      ));
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setAdvancedProjects(prev => prev.map(p => ({ ...p, isDragging: false })));
                    
                    // Check if this is a cross-project move (internal drag)
                    if (dragProjectId && dragProjectId !== project.id && dragSourceIndex !== null) {
                      // Move file from source project to this project
                      setAdvancedProjects(prev => {
                        let fileToMove: File | null = null;
                        const updated = prev.map(p => {
                          if (p.id === dragProjectId && dragSourceIndex !== null) {
                            fileToMove = p.files[dragSourceIndex];
                            return { ...p, files: p.files.filter((_, i) => i !== dragSourceIndex) };
                          }
                          return p;
                        });
                        if (fileToMove) {
                          return updated.map(p => 
                            p.id === project.id 
                              ? { ...p, files: [...p.files, fileToMove!] }
                              : p
                          );
                        }
                        return updated;
                      });
                      setDragSourceIndex(null);
                      setDragProjectId(null);
                      setDragTargetIndex(null);
                    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      // External file drop
                      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
                      if (newFiles.length > 0) {
                        setAdvancedProjects(prev => prev.map(p => 
                          p.id === project.id 
                            ? { ...p, files: [...p.files, ...newFiles] }
                            : p
                        ));
                      }
                    }
                  }}
                  className={`min-h-[60px] mx-2 mb-2 mt-1 border-2 border-dashed rounded-md transition-all ${
                    project.isDragging
                      ? 'border-[#007acc] bg-[#007acc]/10'
                      : 'border-[#333333] bg-[#1a1a1a]'
                  }`}
                >
                  {project.files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-20 text-[#555555]">
                      <Upload className="w-5 h-5 mb-1" />
                      <span className="text-[10px]">Drop videos here</span>
                    </div>
                  ) : (
                    <div className="p-2 space-y-0">
                      {project.files.map((f, fileIndex) => (
                        <div key={`${f.name}-${fileIndex}`} className="relative">
                          {/* Insertion line above this item */}
                          {insertProjectId === project.id && insertIndex === fileIndex && (
                            <div className="absolute -top-0.5 left-0 right-0 h-1 bg-[#007acc] rounded-full z-10 animate-pulse" />
                          )}
                          <div
                            draggable
                            onDragStart={(e) => {
                              setDragSourceIndex(fileIndex);
                              setDragProjectId(project.id);
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', String(fileIndex));
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const y = e.clientY - rect.top;
                              const isTopHalf = y < rect.height / 2;
                              
                              // Internal reorder (same project)
                              if (dragProjectId === project.id && dragSourceIndex !== null && dragSourceIndex !== fileIndex) {
                                setDragTargetIndex(fileIndex);
                              }
                              // Cross-project move OR external file drop - show insertion point
                              if (dragProjectId !== project.id || !dragProjectId) {
                                setInsertProjectId(project.id);
                                setInsertIndex(isTopHalf ? fileIndex : fileIndex + 1);
                              }
                            }}
                            onDragLeave={(e) => {
                              // Only clear if actually leaving this element
                              const rect = e.currentTarget.getBoundingClientRect();
                              const x = e.clientX, y = e.clientY;
                              if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                                setDragTargetIndex(null);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              
                              // Internal reorder (same project)
                              if (dragProjectId === project.id && dragSourceIndex !== null && dragSourceIndex !== fileIndex) {
                                setAdvancedProjects(prev => prev.map(p => {
                                  if (p.id !== project.id) return p;
                                  const newFiles = [...p.files];
                                  const [removed] = newFiles.splice(dragSourceIndex, 1);
                                  newFiles.splice(fileIndex, 0, removed);
                                  return { ...p, files: newFiles };
                                }));
                              }
                              // Cross-project move - insert at specified position
                              else if (dragProjectId && dragProjectId !== project.id && dragSourceIndex !== null && insertIndex !== null) {
                                setAdvancedProjects(prev => {
                                  let fileToMove: File | null = null;
                                  // Remove from source project
                                  const afterRemove = prev.map(p => {
                                    if (p.id === dragProjectId) {
                                      fileToMove = p.files[dragSourceIndex];
                                      return { ...p, files: p.files.filter((_, i) => i !== dragSourceIndex) };
                                    }
                                    return p;
                                  });
                                  // Insert at position in target project
                                  if (fileToMove) {
                                    return afterRemove.map(p => {
                                      if (p.id === project.id) {
                                        const newFiles = [...p.files];
                                        newFiles.splice(insertIndex, 0, fileToMove!);
                                        return { ...p, files: newFiles };
                                      }
                                      return p;
                                    });
                                  }
                                  return afterRemove;
                                });
                              }
                              // External file drop at insertion point
                              else if (!dragProjectId && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                const newFiles = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('video/'));
                                if (newFiles.length > 0 && insertIndex !== null) {
                                  setAdvancedProjects(prev => prev.map(p => {
                                    if (p.id !== project.id) return p;
                                    const updatedFiles = [...p.files];
                                    updatedFiles.splice(insertIndex, 0, ...newFiles);
                                    return { ...p, files: updatedFiles };
                                  }));
                                }
                              }
                              
                              setDragSourceIndex(null);
                              setDragTargetIndex(null);
                              setDragProjectId(null);
                              setInsertProjectId(null);
                              setInsertIndex(null);
                            }}
                            onDragEnd={() => {
                              setDragSourceIndex(null);
                              setDragTargetIndex(null);
                              setDragProjectId(null);
                              setInsertProjectId(null);
                              setInsertIndex(null);
                            }}
                            className={`flex items-center gap-2 px-2 py-1 my-0.5 bg-[#252526] border rounded-sm group cursor-grab active:cursor-grabbing transition-all ${
                              dragProjectId === project.id && dragTargetIndex === fileIndex
                                ? 'border-[#007acc] bg-[#007acc]/10'
                                : dragProjectId === project.id && dragSourceIndex === fileIndex
                                ? 'opacity-50 border-[#555555]'
                                : 'border-[#333333]'
                            }`}
                          >
                            <GripVertical className="w-3 h-3 text-[#444444]" />
                            <FileVideo className="w-4 h-4 text-[#007acc] shrink-0" />
                            <span className="flex-1 text-xs text-[#cccccc] truncate">{f.name}</span>
                            {fileIndex === 0 && (
                              <span className="px-1.5 py-0.5 bg-[#264f78] text-[#7ec8ff] text-[8px] rounded">primary</span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setAdvancedProjects(prev => prev.map(p => 
                                  p.id === project.id 
                                    ? { ...p, files: p.files.filter((_, i) => i !== fileIndex) }
                                    : p
                                ));
                              }}
                              className="p-0.5 text-[#555555] hover:text-[#f44336] opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          {/* Insertion line after last item */}
                          {fileIndex === project.files.length - 1 && insertProjectId === project.id && insertIndex === project.files.length && (
                            <div className="absolute -bottom-0.5 left-0 right-0 h-1 bg-[#007acc] rounded-full z-10 animate-pulse" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Process All Button */}
          <button
            type="button"
            onClick={() => {
              // Collect all files from all projects and trigger processing
              const allProjects = advancedProjects.filter(p => p.files.length > 0);
              if (allProjects.length > 0 && onMultiVideoUpload) {
                // For now, flatten all files - the actual processing logic will need
                // to be implemented to handle the project structure
                console.log('Processing projects:', allProjects);
              }
            }}
            disabled={loading || advancedProjects.every(p => p.files.length === 0)}
            className="w-full py-3 bg-[#007acc] hover:bg-[#0062a3] disabled:bg-[#333333] disabled:text-[#666666] text-white text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 rounded-sm"
          >
            <ArrowUpFromLine className="w-4 h-4" />
            <span>Process All Projects</span>
          </button>
        </div>
      ) : (uploadMode === 'multi-video' || uploadMode === 'batch') ? (
        /* Mode 1 (Multi-Video) and Mode 2 (Batch) */
        <div className="space-y-4">
          {/* Drop Zone / File Input */}
          <label 
            htmlFor="multi-video-input" 
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`group cursor-pointer flex flex-col items-center justify-center h-32 border-2 border-dashed transition-all rounded-md ${
              isDragging 
                ? 'border-[#007acc] bg-[#007acc]/10 scale-[1.02]' 
                : 'border-[#444444] bg-[#2d2d2d] hover:bg-[#333333] hover:border-[#666666]'
            }`}
          >
            <input
              type="file"
              accept="video/*,.sgproj"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="multi-video-input"
              disabled={loading}
            />
            <Upload className={`w-6 h-6 mb-2 transition-colors ${
              isDragging ? 'text-[#007acc]' : 'text-[#666666] group-hover:text-[#999999]'
            }`} />
            <span className={`text-sm font-medium transition-colors ${
              isDragging ? 'text-[#007acc]' : 'text-[#999999] group-hover:text-[#cccccc]'
            }`}>
              {isDragging ? 'Drop videos here' : 'Drop videos or click to browse'}
            </span>
            <span className="text-[10px] text-[#666666] mt-1">
              {uploadMode === 'multi-video' ? 'All files → 1 project' : 'Each file → separate project'}
            </span>
          </label>

          {/* File List */}
          {files.length > 0 && (
            <div className="bg-[#1e1e1e] border border-[#333333] rounded-md overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-[#252526] border-b border-[#333333]">
                <span className="text-xs text-[#888888]">
                  {files.length} video{files.length !== 1 ? 's' : ''} staged
                  {uploadMode === 'batch' && ` → ${files.length} project${files.length !== 1 ? 's' : ''}`}
                </span>
                <button
                  type="button"
                  onClick={() => setFiles([])}
                  className="text-[10px] text-[#666666] hover:text-[#f44336] transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                {files.map((f, idx) => {
                  const isProjectFile = f.name.endsWith('.sgproj');
                  const hasProjectFile = files.some(file => file.name.endsWith('.sgproj'));
                  
                  return (
                    <div 
                      key={`${f.name}-${idx}`}
                      className="flex items-center gap-2 px-2 py-1.5 bg-[#252526] border border-[#333333] rounded-sm group"
                    >
                      {isProjectFile ? (
                        <Lock className="w-3 h-3 text-[#f0a000]" />
                      ) : (
                        <FileVideo className="w-4 h-4 text-[#007acc] shrink-0" />
                      )}
                      <span className="flex-1 text-xs text-[#cccccc] truncate">{f.name}</span>
                      <span className="text-[10px] text-[#555555]">{formatBytes(f.size)}</span>
                      {isProjectFile && (
                        <span className="px-1.5 py-0.5 bg-[#4a3000] text-[#f0a000] text-[8px] rounded flex items-center gap-1">
                          <Lock className="w-2 h-2" />
                          restore
                        </span>
                      )}
                      {!isProjectFile && uploadMode === 'multi-video' && idx === 0 && !hasProjectFile && (
                        <span className="px-1.5 py-0.5 bg-[#264f78] text-[#7ec8ff] text-[8px] rounded">primary</span>
                      )}
                      {!isProjectFile && uploadMode === 'batch' && (
                        <span className="px-1.5 py-0.5 bg-[#3e3e42] text-[#888888] text-[8px] rounded">proj {idx + 1}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                        className="p-0.5 text-[#555555] hover:text-[#f44336] opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Process Button */}
          <button
            type="button"
            onClick={() => {
              if (files.length > 0) {
                console.log(`Processing ${files.length} files in ${uploadMode} mode`);
                // TODO: Implement actual processing logic
                // For multi-video: create single project with all files
                // For batch: create separate projects for each file
                if (onMultiVideoUpload) {
                  onMultiVideoUpload(files);
                }
              }
            }}
            disabled={loading || files.length === 0}
            className="w-full py-3 bg-[#007acc] hover:bg-[#0062a3] disabled:bg-[#333333] disabled:text-[#666666] text-white text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 rounded-sm"
          >
            <ArrowUpFromLine className="w-4 h-4" />
            <span>
              {uploadMode === 'multi-video' 
                ? `Process ${files.length || 0} Video${files.length !== 1 ? 's' : ''} → 1 Project`
                : `Process ${files.length || 0} Video${files.length !== 1 ? 's' : ''} → ${files.length || 0} Project${files.length !== 1 ? 's' : ''}`
              }
            </span>
          </button>
        </div>
      ) : !file ? (
        <label 
          htmlFor="video-input" 
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`group cursor-pointer flex flex-col items-center justify-center h-48 border-2 border-dashed transition-all rounded-md ${
            isDragging 
              ? 'border-[#007acc] bg-[#007acc]/10 scale-[1.02]' 
              : 'border-[#444444] bg-[#2d2d2d] hover:bg-[#333333] hover:border-[#666666]'
          }`}
        >
          <Upload className={`w-8 h-8 mb-3 transition-colors ${
            isDragging ? 'text-[#007acc]' : 'text-[#666666] group-hover:text-[#999999]'
          }`} />
          <span className={`text-sm font-medium transition-colors ${
            isDragging ? 'text-[#007acc]' : 'text-[#999999] group-hover:text-[#cccccc]'
          }`}>
            {isDragging ? 'Drop video here' : 'Import Media File'}
          </span>
          <span className="text-[10px] text-[#666666] mt-1">
            or click to browse
          </span>
        </label>
      ) : (
        <div className="space-y-6">
           <div className="flex items-center space-x-3 p-3 bg-[#2d2d2d] border border-[#3e3e42] rounded-sm">
              <FileVideo className="w-5 h-5 text-[#007acc]" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#e1e1e1] truncate">{file.name}</p>
                <p className="text-xs text-[#888888]">{formatBytes(file.size)}</p>
              </div>
              {!loading && (
                <button onClick={() => setFile(null)} className="text-xs text-[#007acc] hover:underline">Change</button>
              )}
           </div>

           {loading ? (
             <div className="space-y-2 bg-[#1e1e1e] p-3 border border-[#3e3e42] rounded-sm">
                <div className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-2 text-[#cccccc]">
                     <Loader2 className="w-3 h-3 animate-spin text-[#007acc]" />
                     {progress < 100 ? "Uploading..." : "Analyzing..."}
                  </span>
                  <span className="font-mono text-[#007acc]">{progress}%</span>
                </div>
                <div className="w-full bg-[#333333] h-1 rounded-full overflow-hidden">
                  <div className="bg-[#007acc] h-1 transition-all duration-200" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-[#666666] font-mono">
                  <span>{formatBytes(uploadedBytes)}</span>
                  <span>{formatBytes(uploadSpeed)}/s</span>
                </div>
             </div>
           ) : (
             <button
              onClick={handleUpload}
              className="w-full py-2 bg-[#007acc] hover:bg-[#0062a3] text-white text-sm font-semibold shadow-sm transition-colors flex items-center justify-center space-x-2 rounded-sm"
            >
              <Film className="w-4 h-4" />
              <span>Process Video</span>
            </button>
           )}
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center space-x-2 text-xs text-red-400 bg-red-950/20 border border-red-900/50 p-2 rounded-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Model Chooser Modal */}
      {showModelChooser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#252526] border border-[#454545] shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col rounded-lg overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="h-10 bg-[#333333] flex items-center justify-between px-4 text-xs font-semibold text-[#cccccc] select-none shrink-0 border-b border-[#454545]">
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5" />
                <span>Select Gemini Model</span>
              </div>
              <button 
                onClick={() => setShowModelChooser(false)}
                className="hover:bg-[#454545] p-1 rounded transition-colors"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#1e1e1e]">
              {loadingModels ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-[#888888]">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-sm">Fetching available models...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-1.5">
                    {availableModels.map(m => (
                      <button
                        key={m.name}
                        onClick={() => {
                          setSelectedInModal(m.name);
                          setModalTestResult(null);
                        }}
                        className={`flex items-center gap-3 p-3 text-left border rounded-md transition-all duration-200 group ${
                          selectedInModal === m.name
                            ? "bg-[#094771]/20 border-[#007acc] text-white shadow-[0_0_10px_rgba(0,122,204,0.1)]"
                            : "bg-[#252526] border-[#3e3e42] text-[#cccccc] hover:border-[#555555] hover:bg-[#333333]"
                        }`}
                        type="button"
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          selectedInModal === m.name ? "border-[#007acc] bg-[#007acc]" : "border-[#454545] bg-transparent"
                        }`}>
                          {selectedInModal === m.name && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{m.displayName}</div>
                          <div className="text-[10px] opacity-60 font-mono mt-0.5">{m.name}</div>
                        </div>
                        {/* Persistent Test Status Indicator */}
                        {testedModels[m.name] && (
                           <div className={`transition-all duration-300 animate-in zoom-in ${
                             testedModels[m.name].success ? 'text-green-500' : 'text-red-500'
                           }`}>
                             {testedModels[m.name].success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                           </div>
                        )}
                      </button>
                    ))}
                    {availableModels.length === 0 && (
                      <div className="text-center py-8 text-[#666666]">
                        No additional models found.
                      </div>
                    )}
                  </div>

                  {/* Modal Test Result Area */}
                  {modalTestResult && (
                    <div className={`p-3 rounded-md border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
                      modalTestResult.success 
                        ? "bg-[#162a1c] border-[#2d5236] text-[#8ce0a2]" 
                        : "bg-[#351111] border-[#5e2121] text-[#f19999]"
                    }`}>
                      {modalTestResult.success ? (
                        <Check className="w-4 h-4 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="text-xs font-semibold mb-0.5">
                          {modalTestResult.success ? "Test Successful" : "Test Failed"}
                        </div>
                        <div className="text-[11px] opacity-80 leading-relaxed">
                          {modalTestResult.message}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-[#454545] flex justify-between items-center bg-[#252526] gap-3">
              <button
                onClick={fetchModels}
                disabled={loadingModels}
                className="text-[11px] text-[#888888] hover:text-[#cccccc] flex items-center gap-1.5 transition-colors disabled:opacity-50"
                type="button"
              >
                <Loader2 className={`w-3.5 h-3.5 ${loadingModels ? 'animate-spin' : ''}`} />
                <span>Refresh list</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={testModelInModal}
                  disabled={modalTesting || !selectedInModal || loadingModels}
                  className="px-3 h-8 bg-[#333333] hover:bg-[#454545] text-[#cccccc] rounded border border-[#454545] text-[11px] font-medium transition-colors flex items-center gap-2 disabled:opacity-30"
                  type="button"
                >
                  {modalTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  <span>Test Selected</span>
                </button>
                <button
                  onClick={() => {
                    if (selectedInModal) {
                      setModel(selectedInModal);
                      setTestResult(null);
                      setShowModelChooser(false);
                    }
                  }}
                  disabled={!selectedInModal || loadingModels}
                  className="px-4 h-8 bg-[#007acc] hover:bg-[#0062a3] text-white rounded text-[11px] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20"
                  type="button"
                >
                  Confirm Selection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}