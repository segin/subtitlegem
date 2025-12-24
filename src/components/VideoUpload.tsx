"use client";

import React, { useState } from "react";
import { Upload, FileVideo, CheckCircle2, AlertCircle } from "lucide-react";

export function VideoUpload({ onUploadComplete }: { onUploadComplete: (subtitles: any[], videoUrl: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondaryLanguage, setSecondaryLanguage] = useState("Simplified Chinese");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("video", file);
    formData.append("secondaryLanguage", secondaryLanguage);

    try {
      const response = await fetch("/api/process", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const videoUrl = URL.createObjectURL(file);
      onUploadComplete(data.subtitles, videoUrl);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
      <input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
        id="video-input"
      />
      <label htmlFor="video-input" className="cursor-pointer flex flex-col items-center">
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
        <div className="mt-6 w-full max-w-xs space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Language</label>
            <select
              value={secondaryLanguage}
              onChange={(e) => setSecondaryLanguage(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="Simplified Chinese">Simplified Chinese</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="Japanese">Japanese</option>
              <option value="German">German</option>
            </select>
          </div>
          
          <button
            onClick={handleUpload}
            disabled={loading}
            className={`w-full py-2 px-4 rounded-md text-white font-semibold transition-all ${
              loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-md"
            }`}
          >
            {loading ? "Processing with Gemini..." : "Generate Subtitles"}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center text-red-600 text-sm">
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}
    </div>
  );
}
