"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileVideo, AlertCircle, Film, Cpu, Languages, Loader2, Zap, Check, X } from "lucide-react";

interface VideoUploadProps {
  onUploadComplete: (subtitles: any[], videoUrl: string, lang: string, serverPath: string, detectedLanguage?: string) => void;
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

  // Test model in modal
  const testModelInModal = async () => {
    if (!selectedInModal) return;
    setModalTesting(true);
    setModalTestResult(null);
    try {
      const res = await fetch(`/api/models?test=${encodeURIComponent(selectedInModal)}`);
      const data = await res.json();
      setModalTestResult({
        success: data.success,
        message: data.success ? 'Model OK!' : (data.error || 'Model not accessible')
      });
      // Track persistent result
      setTestedModels(prev => ({
        ...prev,
        [selectedInModal]: { success: data.success }
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
          else onUploadComplete(
            data.subtitles, 
            URL.createObjectURL(file), 
            secondaryLanguage, 
            data.videoPath,
            data.detectedLanguage
          );
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

      {!file ? (
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