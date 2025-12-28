"use client";

import { useState, useRef, useEffect } from "react";
import { 
  FileVideo, FolderOpen, Save, Download, X, 
  Undo2, Redo2, Scissors, Copy, ClipboardPaste, Search, 
  Merge, Split, Clock, PanelLeft, PanelBottom, 
  ZoomIn, Palette, Keyboard 
} from "lucide-react";

interface MenuItemBase {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
}

interface MenuDivider {
  divider: true;
}

type MenuItem = MenuItemBase | MenuDivider;

interface MenuProps {
  label: string;
  items: MenuItem[];
}

function Menu({ label, items }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-2 py-0.5 text-xs rounded-sm transition-colors ${
          isOpen ? "bg-[#3e3e42]" : "hover:bg-[#3e3e42]"
        }`}
      >
        {label}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-0.5 w-56 bg-[#252526] border border-[#454545] shadow-xl z-50">
          {items.map((item, index) =>
            'divider' in item ? (
              <div key={index} className="h-px bg-[#454545] my-1" />
            ) : (
              <button
                key={index}
                onClick={() => {
                  if (!item.disabled && item.onClick) {
                    item.onClick();
                    setIsOpen(false);
                  }
                }}
                disabled={item.disabled}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                  item.disabled
                    ? "text-[#555555] cursor-not-allowed"
                    : "text-[#cccccc] hover:bg-[#094771]"
                }`}
              >
                <span className="flex items-center gap-2">
                  {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                  {item.label}
                </span>
                {item.shortcut && (
                  <span className="text-[#888888] text-[10px]">{item.shortcut}</span>
                )}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

interface MenuBarProps {
  onNewProject?: () => void;
  onOpenDraft?: () => void;
  onSaveDraft?: () => void;
  onExportSRT?: () => void;
  onExportASS?: () => void;
  onCloseProject?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onFindReplace?: () => void;
  onShiftTimings?: () => void;
  onToggleTimeline?: () => void;
  onToggleSubtitleList?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onShowShortcuts?: () => void;
}

export function MenuBar({
  onNewProject,
  onOpenDraft,
  onSaveDraft,
  onExportSRT,
  onExportASS,
  onCloseProject,
  onUndo,
  onRedo,
  onFindReplace,
  onShiftTimings,
  onToggleTimeline,
  onToggleSubtitleList,
  onZoomIn,
  onZoomOut,
  onShowShortcuts,
}: MenuBarProps) {
  const fileItems: MenuItem[] = [
    { label: "New Project", icon: <FileVideo className="w-4 h-4" />, shortcut: "Ctrl+N", onClick: onNewProject },
    { label: "Open Draft...", icon: <FolderOpen className="w-4 h-4" />, shortcut: "Ctrl+O", onClick: onOpenDraft },
    { label: "Save Draft", icon: <Save className="w-4 h-4" />, shortcut: "Ctrl+S", onClick: onSaveDraft },
    { divider: true },
    { label: "Export SRT...", icon: <Download className="w-4 h-4" />, onClick: onExportSRT },
    { label: "Export ASS...", icon: <Download className="w-4 h-4" />, onClick: onExportASS },
    { divider: true },
    { label: "Close Project", icon: <X className="w-4 h-4" />, onClick: onCloseProject },
  ];

  const editItems: MenuItem[] = [
    { label: "Undo", icon: <Undo2 className="w-4 h-4" />, shortcut: "Ctrl+Z", onClick: onUndo, disabled: true },
    { label: "Redo", icon: <Redo2 className="w-4 h-4" />, shortcut: "Ctrl+Y", onClick: onRedo, disabled: true },
    { divider: true },
    { label: "Cut", icon: <Scissors className="w-4 h-4" />, shortcut: "Ctrl+X", disabled: true },
    { label: "Copy", icon: <Copy className="w-4 h-4" />, shortcut: "Ctrl+C", disabled: true },
    { label: "Paste", icon: <ClipboardPaste className="w-4 h-4" />, shortcut: "Ctrl+V", disabled: true },
    { divider: true },
    { label: "Find & Replace...", icon: <Search className="w-4 h-4" />, shortcut: "Ctrl+H", onClick: onFindReplace, disabled: true },
    { divider: true },
    { label: "Merge Subtitles", icon: <Merge className="w-4 h-4" />, disabled: true },
    { label: "Split Subtitle", icon: <Split className="w-4 h-4" />, disabled: true },
    { label: "Shift All Timings...", icon: <Clock className="w-4 h-4" />, onClick: onShiftTimings, disabled: true },
  ];

  const viewItems: MenuItem[] = [
    { label: "Toggle Timeline", icon: <PanelBottom className="w-4 h-4" />, onClick: onToggleTimeline, disabled: true },
    { label: "Toggle Subtitle List", icon: <PanelLeft className="w-4 h-4" />, onClick: onToggleSubtitleList, disabled: true },
    { divider: true },
    { label: "Zoom In", icon: <ZoomIn className="w-4 h-4" />, shortcut: "Ctrl++", onClick: onZoomIn, disabled: true },
    { label: "Zoom Out", icon: <ZoomIn className="w-4 h-4" />, shortcut: "Ctrl+-", onClick: onZoomOut, disabled: true },
    { divider: true },
    { label: "Theme Settings...", icon: <Palette className="w-4 h-4" />, disabled: true },
    { label: "Keyboard Shortcuts", icon: <Keyboard className="w-4 h-4" />, shortcut: "Ctrl+?", onClick: onShowShortcuts, disabled: true },
  ];

  return (
    <nav className="flex space-x-1">
      <Menu label="File" items={fileItems} />
      <Menu label="Edit" items={editItems} />
      <Menu label="View" items={viewItems} />
    </nav>
  );
}
