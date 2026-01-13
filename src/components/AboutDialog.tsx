"use client";

import React from "react";
import { X, Github, ExternalLink, Info } from "lucide-react";

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={onClose}>
      <div 
        className="bg-[#252526] border border-[#3e3e42] shadow-2xl w-full max-w-sm rounded-sm flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-10 bg-[#333333] flex items-center justify-between px-3 border-b border-[#454545] shrink-0">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#888888]" />
            <span className="text-sm font-medium text-[#e1e1e1]">About SubtitleGem</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#454545] rounded transition-colors">
            <X className="w-4 h-4 text-[#888888]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[#1e1e1e] border border-[#3e3e42] rounded-full flex items-center justify-center mb-4 shadow-lg">
             <span className="text-2xl font-bold bg-gradient-to-br from-[#0e639c] to-[#007acc] bg-clip-text text-transparent">SG</span>
          </div>
          
          <h2 className="text-xl font-bold text-[#e1e1e1] mb-1">SubtitleGem</h2>
          <p className="text-xs text-[#888888] mb-4">v0.1.0-alpha</p>
          
          <p className="text-sm text-[#cccccc] mb-6 leading-relaxed">
            AI-powered subtitle generation and editing tool.<br/>
            Built with React, Next.js, and Google Gemini.
          </p>
          
          <div className="flex flex-col gap-3 w-full">
            <a 
              href="https://github.com/segin/subtitlegem" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[#2d2d2d] hover:bg-[#3e3e42] border border-[#3e3e42] rounded-sm text-sm text-[#e1e1e1] transition-colors"
            >
              <Github className="w-4 h-4" />
              View Source on GitHub
            </a>
            
            <a 
              href="https://github.com/segin/subtitlegem/issues" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1e1e1e] hover:bg-[#2d2d2d] border border-[#3e3e42] rounded-sm text-sm text-[#888888] hover:text-[#cccccc] transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Report an Issue
            </a>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-3 bg-[#1e1e1e] border-t border-[#333333] text-[10px] text-[#555555] text-center">
          &copy; {new Date().getFullYear()} SubtitleGem. Apache License 2.0.
        </div>
      </div>
    </div>
  );
}
