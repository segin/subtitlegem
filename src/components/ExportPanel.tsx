// src/components/ExportPanel.tsx

// ... imports

export function ExportPanel({ originalVideoPath, subtitles, config }: ExportPanelProps) {
    // ... state and handlers

    return (
        <div className="flex flex-col h-full bg-[#252526] text-[#cccccc] p-3 space-y-4">
            {/* ... hwaccel select ... */}

            <div className="space-y-2">
                <label className="flex items-center space-x-1.5 text-[10px] font-bold text-[#666666] uppercase tracking-wider">
                    <Settings className="w-3 h-3" /> <span>Quality (CRF)</span>
                </label>
                <input
                    type="range"
                    min="18"
                    max="30"
                    step="1"
                    value={exportOptions.crf}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, crf: parseInt(e.target.value) }))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[#1e1e1e] border border-[#333333]"
                />
                <div className="text-[11px] text-[#888888] text-center font-mono">
                    CRF: {exportOptions.crf} 
                    <span className="text-[#666666]"> (Lower = Higher Quality & Size)</span>
                </div>
            </div>

            {/* ... preset select ... */}
            
            {/* ... rest of component */}
        </div>
    );
}