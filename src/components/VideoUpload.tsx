"use client";

import React, { useState, useRef } from "react";
import { Upload, FileVideo, AlertCircle, Film, Cpu, Languages, Loader2 } from "lucide-react";

interface VideoUploadProps {
  onUploadComplete: (subtitles: any[], videoUrl: string, lang: string, serverPath: string) => void;
}

export function VideoUpload({ onUploadComplete }: VideoUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondaryLanguage, setSecondaryLanguage] = useState("Simplified Chinese");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [sampleDuration, setSampleDuration] = useState<number | null>(null);
  
  const [progress, setProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);

  const startTimeRef = useRef<number>(0);

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
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loading}
              className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-xs p-2 focus:border-[#007acc] outline-none"
            >
              <option value="gemini-3.0-flash">Gemini 3.0 Flash (Fastest)</option>
              <option value="gemini-3.0-pro">Gemini 3.0 Pro (Advanced)</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            </select>
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

        {/* Sample Duration Selector */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-[#666666] tracking-wider">Sample Mode (Testing)</label>
          <div className="flex space-x-2">
            <button
              onClick={() => setSampleDuration(null)}
              disabled={loading}
              className={`flex-1 py-2 text-xs font-medium rounded-sm transition-colors ${
                sampleDuration === null
                  ? 'bg-[#007acc] text-white'
                  : 'bg-[#2d2d2d] text-[#888888] hover:bg-[#3e3e42] hover:text-[#cccccc]'
              }`}
            >
              Full Video
            </button>
            <button
              onClick={() => setSampleDuration(2)}
              disabled={loading}
              className={`flex-1 py-2 text-xs font-medium rounded-sm transition-colors ${
                sampleDuration === 2
                  ? 'bg-[#007acc] text-white'
                  : 'bg-[#2d2d2d] text-[#888888] hover:bg-[#3e3e42] hover:text-[#cccccc]'
              }`}
            >
              2 seconds
            </button>
            <button
              onClick={() => setSampleDuration(5)}
              disabled={loading}
              className={`flex-1 py-2 text-xs font-medium rounded-sm transition-colors ${
                sampleDuration === 5
                  ? 'bg-[#007acc] text-white'
                  : 'bg-[#2d2d2d] text-[#888888] hover:bg-[#3e3e42] hover:text-[#cccccc]'
              }`}
            >
              5 seconds
            </button>
            <button
              onClick={() => setSampleDuration(10)}
              disabled={loading}
              className={`flex-1 py-2 text-xs font-medium rounded-sm transition-colors ${
                sampleDuration === 10
                  ? 'bg-[#007acc] text-white'
                  : 'bg-[#2d2d2d] text-[#888888] hover:bg-[#3e3e42] hover:text-[#cccccc]'
              }`}
            >
              10 seconds
            </button>
          </div>
          {sampleDuration !== null && (
            <p className="text-[10px] text-[#d7ba7d] mt-1">
              ⚠ Sample mode will only process the first {sampleDuration} seconds
            </p>
          )}
        </div>
      </div>

      {!file ? (
        <label 
          htmlFor="video-input" 
          className="group cursor-pointer flex flex-col items-center justify-center h-48 border border-dashed border-[#444444] bg-[#2d2d2d] hover:bg-[#333333] hover:border-[#666666] transition-all"
        >
          <Upload className="w-8 h-8 text-[#666666] group-hover:text-[#999999] mb-3" />
          <span className="text-sm font-medium text-[#999999] group-hover:text-[#cccccc]">Import Media File</span>
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
    </div>
  );
}