"use client";

import React, { useState, useRef } from "react";
import { Upload, FileVideo, CheckCircle2, AlertCircle } from "lucide-react";

export function VideoUpload({ onUploadComplete }: { onUploadComplete: (subtitles: any[], videoUrl: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondaryLanguage, setSecondaryLanguage] = useState("Simplified Chinese");
  
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
    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors w-full max-w-2xl mx-auto">
      <input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
        id="video-input"
        disabled={loading}
      />
      <label htmlFor="video-input" className={`cursor-pointer flex flex-col items-center ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
        {file ? (
          <FileVideo className="w-16 h-16 text-blue-500 mb-4" />
        ) : (
          <Upload className="w-16 h-16 text-gray-400 mb-4" />
        )}
        <span className="text-lg font-medium text-gray-700">
          {file ? file.name : "Select a video to subtitle"}
        </span>
        <span className="text-sm text-gray-500 mt-1">
          Supports most video formats (max 400MB for direct video)
        </span>
      </label>

      {file && (
        <div className="mt-6 w-full max-w-md space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Language</label>
            <select
              value={secondaryLanguage}
              onChange={(e) => setSecondaryLanguage(e.target.value)}
              disabled={loading}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="Simplified Chinese">Simplified Chinese</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="Japanese">Japanese</option>
              <option value="German">German</option>
              <option value="None">None</option>
            </select>
          </div>
          
          {loading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-600">
                <span>{progress < 100 ? "Uploading..." : "Processing with Gemini..."}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>{formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}</span>
                <span>{formatBytes(uploadSpeed)}/s</span>
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={loading}
            className={`w-full py-2 px-4 rounded-md text-white font-semibold transition-all ${
              loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-md"
            }`}
          >
            {loading ? "Processing..." : "Generate Subtitles"}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center text-red-600 text-sm p-3 bg-red-50 rounded-md border border-red-200 w-full justify-center">
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}
    </div>
  );
}