import React, { useState, useEffect, useRef } from 'react';
import { SubtitleLine } from "@/types/subtitle";
import { SubtitleTimeline } from './SubtitleTimeline';

interface PreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  isLoading: boolean;
  subtitles: SubtitleLine[];
  videoPath?: string; // Optional: path or URL to the sample video clip if available
  durationSeconds: number;
}

export function PreviewDialog({ isOpen, onClose, onApply, isLoading, subtitles, videoPath, durationSeconds }: PreviewDialogProps) {
  const [showVideo, setShowVideo] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (showVideo && videoRef.current) {
        // Reset video when shown
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(e => console.warn("Autoplay blocked", e));
    }
  }, [showVideo]);

  // Sync timeline with video time updates
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-[#252526] border border-[#454545] rounded-lg shadow-2xl w-[800px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[#333]">
          <h3 className="font-semibold text-sm text-[#cccccc]">
            Sample Preview <span className="text-[#888] font-normal ml-2">(First {durationSeconds}s)</span>
          </h3>
          <button onClick={onClose} className="text-[#888] hover:text-[#fff]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-[#1e1e1e] relative min-h-[300px] flex flex-col">
           
           {isLoading ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                   <div className="w-6 h-6 border-2 border-[#007acc] border-t-transparent rounded-full animate-spin"></div>
                   <span className="text-xs text-[#888]">Generating preview...</span>
               </div>
           ) : (
               <>
                 {/* Collapsible Video Player */}
                 {showVideo && (
                     <div className="relative bg-black aspect-video flex items-center justify-center border-b border-[#333]">
                         {videoPath ? (
                             <video 
                               ref={videoRef}
                               src={videoPath} 
                               className="w-full h-full object-contain"
                               controls
                               onTimeUpdate={handleTimeUpdate}
                             >
                                <track kind="captions" />
                             </video>
                         ) : (
                             <div className="text-[#666] text-xs">Video preview not available (local file access required)</div>
                         )}
                         
                         {/* Simple HTML Overlay for subtitles if track not working seamlessly */}
                         <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none p-2">
                             {subtitles.filter(s => currentTime >= s.startTime && currentTime <= s.endTime).map(s => (
                                 <div key={s.id} className="bg-black/60 text-white px-2 py-1 inline-block rounded text-sm mb-1">
                                     {s.text}<br/>
                                     <span className="text-[#8ecfff]">{s.secondaryText}</span>
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}

                 {/* Timeline View */}
                 <div className="flex-1 p-4 flex flex-col">
                     <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] uppercase font-bold text-[#666]">Timeline Visualization</span>
                        <button 
                          onClick={() => setShowVideo(!showVideo)}
                          className="text-xs text-[#007acc] hover:underline flex items-center gap-1"
                        >
                            {showVideo ? "Hide Video" : "Show Video"} 
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className={showVideo ? "rotate-180" : ""}>
                                <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
                            </svg>
                        </button>
                     </div>
                     
                     <div className="flex-1 bg-[#252526] border border-[#3e3e42] rounded relative overflow-hidden">
                         {/* Use SubtitleTimeline in ReadOnly mode */}
                         <SubtitleTimeline 
                            subtitles={subtitles}
                            duration={durationSeconds} 
                            currentTime={currentTime}
                            onSeek={(t: number) => {
                                setCurrentTime(t);
                                if (videoRef.current) videoRef.current.currentTime = t;
                            }}
                            readOnly={true}
                            onSubtitlesUpdate={() => {}} 
                            selectedIds={[]}
                            onSelect={() => {}}
                            onSplit={() => {}}
                         />
                     </div>
                 </div>
               </>
           )}

        </div>

        {/* Footer */}
        <div className="p-3 bg-[#252526] border-t border-[#333] flex justify-between items-center">
            <span className="text-xs text-[#666]">
                {isLoading ? "Processing..." : `Generated ${subtitles.length} subtitle lines`}
            </span>
            <div className="flex items-center gap-2">
                <button 
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs text-[#cccccc] hover:bg-[#3e3e42] rounded border border-[#3e3e42]"
                >
                    Close
                </button>
                <button 
                  onClick={onApply}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs bg-[#007acc] hover:bg-[#0062a3] text-white rounded disabled:opacity-50"
                >
                    Apply Settings
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
