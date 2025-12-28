"use client";

import { useState, useEffect } from "react";
import { Sparkles, Check, X, Loader2, ChevronDown, Zap } from "lucide-react";

interface ModelInfo {
  name: string;
  displayName: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
}

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Default models to show before fetching
  const defaultModels = [
    { name: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
    { name: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro" },
    { name: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash" },
    { name: "gemini-1.5-flash", displayName: "Gemini 1.5 Flash" },
    { name: "gemini-1.5-pro", displayName: "Gemini 1.5 Pro" },
  ];

  const displayModels = models.length > 0 ? models : defaultModels;

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/models");
      const data = await res.json();
      if (data.models) {
        setModels(data.models);
      }
    } catch (err) {
      console.error("Failed to fetch models:", err);
    } finally {
      setLoading(false);
    }
  };

  const testModel = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/models?test=${encodeURIComponent(selectedModel)}`);
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.success ? "Model is accessible!" : (data.error || "Model not accessible")
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Failed to test model"
      });
    } finally {
      setTesting(false);
    }
  };

  const selectedDisplay = displayModels.find(m => m.name === selectedModel)?.displayName || selectedModel;

  return (
    <div className="flex items-center gap-2">
      {/* Model Dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-[#3e3e42] hover:bg-[#4e4e52] border border-[#555555] rounded-sm transition-colors"
        >
          <Sparkles className="w-3 h-3 text-purple-400" />
          <span className="text-[#e1e1e1]">{selectedDisplay}</span>
          <ChevronDown className="w-3 h-3 text-[#888888]" />
        </button>

        {showDropdown && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-[#252526] border border-[#454545] shadow-xl z-50 max-h-64 overflow-y-auto">
            {displayModels.map(model => (
              <button
                key={model.name}
                onClick={() => {
                  onModelChange(model.name);
                  setShowDropdown(false);
                  setTestResult(null);
                }}
                className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                  model.name === selectedModel
                    ? "bg-[#094771] text-white"
                    : "text-[#cccccc] hover:bg-[#3e3e42]"
                }`}
              >
              <div className="font-medium">{model.displayName}</div>
                {(model as ModelInfo).description && (
                  <div className="text-[10px] text-[#888888] truncate mt-0.5">
                    {(model as ModelInfo).description}
                  </div>
                )}
              </button>
            ))}
            
            {/* Fetch more models */}
            <div className="border-t border-[#454545]">
              <button
                onClick={() => {
                  fetchModels();
                  setShowDropdown(false);
                }}
                className="w-full px-3 py-2 text-left text-xs text-[#888888] hover:bg-[#3e3e42] hover:text-[#cccccc] transition-colors"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading models...
                  </span>
                ) : (
                  "... Refresh model list"
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Test Button */}
      <button
        onClick={testModel}
        disabled={testing}
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 text-white rounded-sm transition-colors"
      >
        {testing ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Zap className="w-3 h-3" />
        )}
        <span>Test</span>
      </button>

      {/* Test Result */}
      {testResult && (
        <div className={`flex items-center gap-1 text-xs ${
          testResult.success ? "text-green-400" : "text-red-400"
        }`}>
          {testResult.success ? (
            <Check className="w-4 h-4" />
          ) : (
            <X className="w-4 h-4" />
          )}
          <span className="max-w-[150px] truncate">{testResult.message}</span>
        </div>
      )}
    </div>
  );
}
