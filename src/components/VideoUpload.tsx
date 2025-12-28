"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileVideo, AlertCircle, Film, Cpu, Languages, Loader2, Zap, Check, X } from "lucide-react";

interface VideoUploadProps {
  onUploadComplete: (subtitles: any[], videoUrl: string, lang: string, serverPath: string) => void;
}

export function VideoUpload({ onUploadComplete }: VideoUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondaryLanguage, setSecondaryLanguage] = useState("Simplified Chinese");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [isDragging, setIsDragging] = useState(false);
  
  const [progress, setProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  
  // Model testing
  const [availableModels, setAvailableModels] = useState<{name: string; displayName: string}[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);
  const [showModelChooser, setShowModelChooser] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

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

  // Test current model
  const testModel = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/models?test=${encodeURIComponent(model)}`);
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.success ? 'Model OK!' : (data.error || 'Model not accessible')
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

  // Open model chooser - fetch models if not loaded
  const openModelChooser = async () => {
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
    if (selectedFile.type.startsWith('video/')) {
      setFile(selectedFile);
      setError(null);
      setProgress(0);
    } else {
      setError('Please select a video file');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
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
      handleFileSelect(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setProgress(0);
    setUploadedBytes(0);
    setTotalBytes(file.size);
    setUploadSpeed(0);

    const formData = new FormData();
    formData.append("video", file);
    formData.append("secondaryLanguage", secondaryLanguage);
    formData.append("model", model);

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
          else onUploadComplete(data.subtitles, URL.createObjectURL(file), secondaryLanguage, data.videoPath);
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
    <div className="w-full bg-[#252526] p-6 text-[#cccccc]">
      <input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
        id="video-input"
        disabled={loading}
      />
      
      {/* Model and Language Selection - Always visible */}
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
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
                className="flex-1 bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-xs p-2 focus:border-[#007acc] outline-none"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                {/* Show current model if it's not in the main list */}
                {!['gemini-2.5-flash','gemini-2.5-pro','gemini-2.0-flash','gemini-1.5-flash','gemini-1.5-pro'].includes(model) && (
                  <option value={model}>{model}</option>
                )}
                <option value="...">... (Choose other model)</option>
              </select>
              <button
                type="button"
                onClick={testModel}
                disabled={testing || loading}
                className="px-2 py-1 bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 text-white text-xs rounded-sm transition-colors flex items-center gap-1"
                title="Test model"
              >
                {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
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
              className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-xs p-2 focus:border-[#007acc] outline-none"
            >
              <option value="None">None</option>
              <option value="Simplified Chinese">Simplified Chinese</option>
              <option value="Traditional Chinese">Traditional Chinese</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Japanese">Japanese</option>
              <option value="Russian">Russian</option>
              <option value="Arabic">Arabic</option>
              <option value="Dutch">Dutch</option>
              <option value="Ukrainian">Ukrainian</option>
            </select>
          </div>
        </div>
      </div>

      {!file ? (
        <label 
          htmlFor="video-input" 
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`group cursor-pointer flex flex-col items-center justify-center h-48 border-2 border-dashed transition-all ${
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
           <div className="flex items-center space-x-3 p-3 bg-[#2d2d2d] border border-[#3e3e42]">
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
             <div className="space-y-2 bg-[#1e1e1e] p-3 border border-[#3e3e42]">
                <div className="flex justify-between items-center text-xs">
                  <span className="flex items-center gap-2 text-[#cccccc]">
                     <Loader2 className="w-3 h-3 animate-spin text-[#007acc]" />
                     {progress < 100 ? "Uploading..." : "Analyzing..."}
                  </span>
                  <span className="font-mono text-[#007acc]">{progress}%</span>
                </div>
                <div className="w-full bg-[#333333] h-1">
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
        <div className="mt-4 flex items-center space-x-2 text-xs text-red-400 bg-red-950/20 border border-red-900/50 p-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Model Chooser Modal */}
      {showModelChooser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#252526] border border-[#454545] shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
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
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {loadingModels ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-[#888888]">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-sm">Fetching available models...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {availableModels.map(m => (
                    <button
                      key={m.name}
                      onClick={() => {
                        setModel(m.name);
                        setShowModelChooser(false);
                        setTestResult(null);
                      }}
                      className={`flex flex-col p-3 text-left border rounded transition-colors ${
                        model === m.name
                          ? "bg-[#094771] border-[#007acc] text-white"
                          : "bg-[#1e1e1e] border-[#3e3e42] text-[#cccccc] hover:bg-[#2a2d2e]"
                      }`}
                      type="button"
                    >
                      <div className="text-sm font-medium">{m.displayName}</div>
                      <div className="text-[10px] opacity-60 font-mono mt-1">{m.name}</div>
                    </button>
                  ))}
                  {availableModels.length === 0 && (
                    <div className="text-center py-8 text-[#666666]">
                      No additional models found.
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-[#454545] flex justify-between items-center bg-[#1e1e1e]">
              <div className="text-[10px] text-[#666666]">
                Click a model to select it.
              </div>
              <button
                onClick={fetchModels}
                disabled={loadingModels}
                className="text-[10px] text-[#007acc] hover:underline flex items-center gap-1"
                type="button"
              >
                <Loader2 className={`w-3 h-3 ${loadingModels ? 'animate-spin' : ''}`} />
                Refresh list
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}