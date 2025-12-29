// ... imports
import { TrackStyle, Alignment } from "@/types/subtitle";
import { RotateCcw } from "lucide-react";

interface TrackStyleEditorProps {
  style: Partial<TrackStyle>;
  onChange: (updates: Partial<TrackStyle>) => void;
  onReset?: () => void;
  compact?: boolean;
  mode?: 'percentage' | 'pixel'; // New prop to control unit behavior
}

const ALIGNMENTS = [
  { value: 7, label: 'Top Left' }, { value: 8, label: 'Top Center' }, { value: 9, label: 'Top Right' },
  { value: 4, label: 'Middle Left' }, { value: 5, label: 'Middle Center' }, { value: 6, label: 'Middle Right' },
  { value: 1, label: 'Bottom Left' }, { value: 2, label: 'Bottom Center' }, { value: 3, label: 'Bottom Right' },
];

const FONTS = ['Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Georgia', 'Times New Roman', 'Courier New'];

export function TrackStyleEditor({ style, onChange, onReset, compact = false, mode = 'pixel' }: TrackStyleEditorProps) {
  
  const update = (key: keyof TrackStyle, value: any) => {
    // If unit mode is different, handle conversion if needed, OR just save raw
    // For this editor, we enforce the unit of the mode.
    // If mode is percentage, we save string "50%".
    // If mode is pixel, we save number 50.
    
    // BUT user input comes from type="number" input usually.
    // We append % if needed.
    
    if (value === undefined || value === '') {
        onChange({ [key]: undefined });
        return;
    }

    if (key === 'fontSize' || key === 'marginV' || key === 'marginH' || key === 'outlineWidth' || key === 'shadowDistance') {
        if (mode === 'percentage') {
             onChange({ [key]: `${value}%` });
        } else {
             onChange({ [key]: Number(value) });
        }
    } else {
        onChange({ [key]: value });
    }
  };

  // Helper to extract numeric value for input field
  const getValue = (val: number | string | undefined) => {
      if (val === undefined) return '';
      if (typeof val === 'number') return val;
      return parseFloat(val); // Extract number from "50%"
  };

  const unitLabel = mode === 'percentage' ? '(%)' : '(px)';
  const step = mode === 'percentage' ? 0.1 : 1; 
  const fineStep = mode === 'percentage' ? 0.05 : 0.1;

  return (
    <div className={`space-y-3 ${compact ? 'text-xs' : ''}`}>
      {/* Header with Reset */}
      {onReset && (
        <div className="flex justify-end">
           <button 
             onClick={onReset}
             className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300"
           >
             <RotateCcw className="w-3 h-3" />
             Clear Overrides
           </button>
        </div>
      )}

      {/* Font Size & Family */}
      <div className="grid grid-cols-2 gap-3">
         <div>
          <label className="text-[9px] uppercase text-[#666] font-bold mb-1 block">Font Size {unitLabel}</label>
          <input
            type="number"
            step={step}
            value={getValue(style.fontSize)}
             placeholder="Inherit"
            onChange={(e) => update('fontSize', e.target.value)}
            className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#ccc] text-xs p-1.5 focus:border-[#007acc] outline-none placeholder:text-[#444]"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase text-[#666] font-bold mb-1 block">Font Family</label>
          <select
            value={style.fontFamily ?? ''}
            onChange={(e) => update('fontFamily', e.target.value || undefined)}
            className={`w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#ccc] text-xs p-1.5 focus:border-[#007acc] outline-none ${!style.fontFamily ? 'text-[#444]' : ''}`}
          >
            <option value="">Inherit</option>
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* Alignment */}
      <div>
        <label className="text-[9px] uppercase text-[#666] font-bold mb-1 block">Alignment</label>
        <select
          value={style.alignment ?? ''}
          onChange={(e) => update('alignment', e.target.value ? parseInt(e.target.value) : undefined)}
          className={`w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#ccc] text-xs p-1.5 focus:border-[#007acc] outline-none ${!style.alignment ? 'text-[#444]' : ''}`}
        >
          <option value="">Inherit</option>
          {ALIGNMENTS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] uppercase text-[#666] font-bold mb-1 block">Text Color</label>
          <div className="flex gap-1">
            <input
              type="color"
              value={style.color || '#ffffff'}
              onChange={(e) => update('color', e.target.value)}
              className="w-8 h-7 border border-[#3e3e42] cursor-pointer opacity-80 hover:opacity-100"
              disabled={style.color === undefined && !style.color}
            />
            <input
              type="text"
              value={style.color ?? ''}
              placeholder="Inherit"
              onChange={(e) => update('color', e.target.value || undefined)}
              className="flex-1 bg-[#1e1e1e] border border-[#3e3e42] text-[#ccc] text-xs p-1.5 focus:border-[#007acc] outline-none font-mono placeholder:text-[#444]"
            />
          </div>
        </div>
        <div>
          <label className="text-[9px] uppercase text-[#666] font-bold mb-1 block">Outline Color</label>
          <div className="flex gap-1">
            <input
              type="color"
              value={style.outlineColor || '#000000'}
              onChange={(e) => update('outlineColor', e.target.value)}
              className="w-8 h-7 border border-[#3e3e42] cursor-pointer opacity-80 hover:opacity-100"
            />
            <input
              type="text"
              value={style.outlineColor ?? ''}
              placeholder="Inherit"
              onChange={(e) => update('outlineColor', e.target.value || undefined)}
              className="flex-1 bg-[#1e1e1e] border border-[#3e3e42] text-[#ccc] text-xs p-1.5 focus:border-[#007acc] outline-none font-mono placeholder:text-[#444]"
            />
          </div>
        </div>
      </div>

      {/* Background */}
      <div>
        <label className="text-[9px] uppercase text-[#666] font-bold mb-1 block">Background</label>
        <input
          type="text"
          value={style.backgroundColor ?? ''}
          onChange={(e) => update('backgroundColor', e.target.value || undefined)}
          placeholder="Inherit (e.g. rgba(0,0,0,0.5))"
          className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#ccc] text-xs p-1.5 focus:border-[#007acc] outline-none font-mono placeholder:text-[#444]"
        />
      </div>

      {/* Margins */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] uppercase text-[#666] font-bold mb-1 block">V Margin {unitLabel}</label>
          <input
            type="number"
            step={step}
            value={getValue(style.marginV)}
            placeholder="Inherit"
            onChange={(e) => update('marginV', e.target.value)}
            className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#ccc] text-xs p-1.5 focus:border-[#007acc] outline-none placeholder:text-[#444]"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase text-[#666] font-bold mb-1 block">H Margin {unitLabel}</label>
          <input
            type="number"
            step={step}
            value={getValue(style.marginH)}
            placeholder="Inherit"
            onChange={(e) => update('marginH', e.target.value)}
            className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#ccc] text-xs p-1.5 focus:border-[#007acc] outline-none placeholder:text-[#444]"
          />
        </div>
      </div>

      {/* Outline & Shadow */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] uppercase text-[#666] font-bold mb-1 block">Outline {unitLabel}</label>
          <input
            type="number"
            step={fineStep}
            value={getValue(style.outlineWidth)}
            placeholder="Inherit"
            onChange={(e) => update('outlineWidth', e.target.value)}
            className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#ccc] text-xs p-1.5 focus:border-[#007acc] outline-none placeholder:text-[#444]"
          />
        </div>
        <div>
          <label className="text-[9px] uppercase text-[#666] font-bold mb-1 block">Shadow {unitLabel}</label>
          <input
            type="number"
            step={fineStep}
            value={getValue(style.shadowDistance)}
            placeholder="Inherit"
            onChange={(e) => update('shadowDistance', e.target.value)}
            className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#ccc] text-xs p-1.5 focus:border-[#007acc] outline-none placeholder:text-[#444]"
          />
        </div>
      </div>
    </div>
  );
}
