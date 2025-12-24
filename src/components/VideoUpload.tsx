"use client";

import React, { useState, useRef } from "react";
import { Upload, FileVideo, CheckCircle2, AlertCircle, Film, Languages, Cpu, Loader2 } from "lucide-react";

export function VideoUpload({ onUploadComplete }: { onUploadComplete: (subtitles: any[], videoUrl: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondaryLanguage, setSecondaryLanguage] = useState("Simplified Chinese");
  const [model, setModel] = useState("gemini-2.5-flash");
  
  // Progress tracking state
  const [progress, setProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0); // bytes per second

  const startTimeRef = useRef<number>(0);
  const lastLoadedRef = useRef<number>(0);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setProgress(0);
      setUploadedBytes(0);
      setTotalBytes(0);
      setUploadSpeed(0);
    }
  };

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
    lastLoadedRef.current = 0;

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const now = Date.now();
        const timeDiff = (now - startTimeRef.current) / 1000; // seconds

        // Calculate speed
        if (timeDiff > 0) {
            const speed = event.loaded / timeDiff;
            setUploadSpeed(speed);
        }

        setProgress(Math.round((event.loaded / event.total) * 100));
        setUploadedBytes(event.loaded);
        setTotalBytes(event.total);
        lastLoadedRef.current = event.loaded;
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.error) {
            setError(data.error);
          } else {
            const videoUrl = URL.createObjectURL(file);
            onUploadComplete(data.subtitles, videoUrl);
          }
        } catch (e) {
          setError("Failed to parse response");
        }
      } else if (xhr.status === 429) {
        setError("Gemini API Rate Limit exceeded. Please wait a minute and try again.");
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.error && (data.error.includes("429") || data.error.includes("quota"))) {
            setError("Gemini API Rate Limit exceeded. Please wait a minute and try again.");
          } else {
            setError(data.error || `Upload failed: ${xhr.statusText}`);
          }
        } catch (e) {
          setError(`Upload failed: ${xhr.statusText}`);
        }
      }
      setLoading(false);
    });

    xhr.addEventListener("error", () => {
      setError("Network error occurred during upload");
      setLoading(false);
    });

    xhr.open("POST", "/api/process");
    xhr.send(formData);
  };

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 transition-all">
      <input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
        id="video-input"
        disabled={loading}
      />
      
      {!file ? (
        <label 
          htmlFor="video-input" 
          className="group cursor-pointer flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-700 rounded-xl hover:border-indigo-500 hover:bg-slate-800/50 transition-all duration-300"
        >
          <div className="p-4 bg-slate-800 rounded-full mb-4 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
            <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-200 mb-1 group-hover:text-white">Click to Upload Video</h3>
          <p className="text-sm text-slate-500">MP4, MOV, MKV up to 400MB (Direct) or larger (Audio Extract)</p>
        </label>
      ) : (
        <div className="space-y-6">
           <div className="flex items-center space-x-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
              <div className="p-3 bg-indigo-500/20 rounded-lg">
                <FileVideo className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{file.name}</p>
                <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
              </div>
              {!loading && (
                <button 
                  onClick={() => setFile(null)}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Change
                </button>
              )}
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1.5">
               <label className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                 <Cpu className="w-3 h-3" />
                 <span>AI Model</span>
               </label>
               <div className="relative">
                 <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={loading}
                    className="w-full appearance-none bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:opacity-50"
                  >
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (High Quality)</option>
                  </select>
               </div>
             </div>
             
             <div className="space-y-1.5">
               <label className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                 <Languages className="w-3 h-3" />
                 <span>Target Language</span>
               </label>
               <div className="relative">
                  <select
                    value={secondaryLanguage}
                    onChange={(e) => setSecondaryLanguage(e.target.value)}
                    disabled={loading}
                    className="w-full appearance-none bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:opacity-50"
                  >
                    <option value="Simplified Chinese">Simplified Chinese</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="Japanese">Japanese</option>
                    <option value="German">German</option>
                    <option value="None">None (English Only)</option>
                  </select>
               </div>
             </div>
           </div>

           {loading ? (
             <div className="space-y-3 bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                <div className="flex justify-between items-end">
                  <div className="flex items-center space-x-2">
                     <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                     <span className="text-sm font-medium text-slate-200">
                        {progress < 100 ? "Uploading Video..." : "AI Processing..."}
                     </span>
                  </div>
                  <span className="text-sm font-mono text-indigo-400">{progress}%</span>
                </div>
                
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full transition-all duration-300 ease-out relative" 
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                  </div>
                </div>
                
                <div className="flex justify-between text-[10px] text-slate-500 font-mono uppercase">
                  <span>{formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}</span>
                  <span>{formatBytes(uploadSpeed)}/s</span>
                </div>
             </div>
           ) : (
             <button
              onClick={handleUpload}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
            >
              <Film className="w-5 h-5" />
              <span>Generate Subtitles</span>
            </button>
           )}
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-start space-x-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}