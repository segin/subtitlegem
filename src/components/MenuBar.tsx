"use client";

import { useState, useRef, useEffect } from "react";
import { 
  FileVideo, FolderOpen, Save, Download, X, RefreshCw,
  Undo2, Redo2, Scissors, Copy, ClipboardPaste, Search, 
  Merge, Split, Clock, PanelLeft, PanelBottom, 
  ZoomIn, Palette, Keyboard, Settings 
} from "lucide-react";

interface MenuItemBase {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: (e?: React.MouseEvent) => void;
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
                onClick={(e) => {
                  if (!item.disabled && item.onClick) {
                    item.onClick(e);
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
  onExport?: (format: 'ass' | 'srt' | 'srt-primary' | 'srt-secondary' | 'txt') => void;
  onCloseProject?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onFindReplace?: () => void;
  onShiftTimings?: () => void;
  onToggleTimeline?: () => void;
  onToggleSubtitleList?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onShowShortcuts?: () => void;
  onSaveProject?: () => void;
  onOpenProject?: (e?: React.MouseEvent) => void;
  onProjectSettings?: () => void;
  onReprocessVideo?: () => void;
  onGlobalSettings?: () => void;
  hasSecondarySubtitles?: boolean;
  primaryLanguage?: string;
  secondaryLanguage?: string;
  isUploadScreen?: boolean;
  onToggleQueue?: () => void;
  onVideoProperties?: () => void;
  onToggleVideoLibrary?: () => void;
}

export function MenuBar({
  onNewProject,
  onOpenDraft,
  onSaveDraft,
  onExport,
  onCloseProject,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onFindReplace,
  onShiftTimings,
  onToggleTimeline,
  onToggleSubtitleList,
  onZoomIn,
  onZoomOut,
  onShowShortcuts,
  onSaveProject,
  onOpenProject,
  onProjectSettings,
  onReprocessVideo,
  onGlobalSettings,
  hasSecondarySubtitles = false,
  primaryLanguage = 'English',
  secondaryLanguage = 'Secondary',
  isUploadScreen = false,
  onToggleQueue,
  onVideoProperties,
  onToggleVideoLibrary,
}: MenuBarProps) {
  const fileItems: MenuItem[] = [
    { label: "New Project", icon: <FileVideo className="w-4 h-4" />, shortcut: "Ctrl+N", onClick: onNewProject },
    { label: "Open Project...", icon: <FolderOpen className="w-4 h-4" />, shortcut: "Ctrl+O", onClick: onOpenProject },
    { label: "Save Project", icon: <Save className="w-4 h-4" />, shortcut: "Ctrl+S", onClick: onSaveProject },
    { divider: true },
    { label: "Open Draft...", icon: <FolderOpen className="w-4 h-4" />, onClick: onOpenDraft },
    { label: "Save Draft", icon: <Save className="w-4 h-4" />, onClick: onSaveDraft },
    { divider: true },
    { label: "Export Project (.ass)", icon: <Download className="w-4 h-4" />, onClick: () => onExport?.('ass') },
    
    // Split SRT Export with Dynamic Labels
    { 
      label: hasSecondarySubtitles ? `Export ${primaryLanguage} (.srt)` : "Export Subtitles (.srt)", 
      icon: <Download className="w-4 h-4" />, 
      onClick: () => onExport?.(hasSecondarySubtitles ? 'srt-primary' : 'srt') 
    },
    ...(hasSecondarySubtitles ? [{
      label: `Export ${secondaryLanguage} (.srt)`, 
      icon: <Download className="w-4 h-4" />, 
      onClick: () => onExport?.('srt-secondary') 
    }] : []),

    { label: "Export Transcript (.txt)", icon: <Download className="w-4 h-4" />, onClick: () => onExport?.('txt') },
    { divider: true },
    { label: "Reprocess Video...", icon: <RefreshCw className="w-4 h-4" />, onClick: onReprocessVideo },
    { label: "Close Project", icon: <X className="w-4 h-4" />, onClick: onCloseProject },
  ];

  const editItems: MenuItem[] = [
    { label: "Undo", icon: <Undo2 className="w-4 h-4" />, shortcut: "Ctrl+Z", onClick: onUndo, disabled: !canUndo || isUploadScreen },
    { label: "Redo", icon: <Redo2 className="w-4 h-4" />, shortcut: "Ctrl+Y", onClick: onRedo, disabled: !canRedo || isUploadScreen },
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
    { divider: true },
    { label: "Project Settings...", icon: <Settings className="w-4 h-4" />, onClick: onProjectSettings, disabled: isUploadScreen },
    { divider: true },
    { label: "Global Settings...", icon: <Settings className="w-4 h-4" />, onClick: onGlobalSettings },
  ];

  const viewItems: MenuItem[] = [
    { label: "Video Assets", icon: <FileVideo className="w-4 h-4" />, onClick: onToggleVideoLibrary, disabled: isUploadScreen },
    { label: "Video Properties...", icon: <FileVideo className="w-4 h-4" />, onClick: onVideoProperties, disabled: isUploadScreen },
    { divider: true },
    { label: "Toggle Timeline", icon: <PanelBottom className="w-4 h-4" />, onClick: onToggleTimeline, disabled: true },
    { label: "Toggle Subtitle List", icon: <PanelLeft className="w-4 h-4" />, onClick: onToggleSubtitleList, disabled: true },
    { divider: true },
    { label: "Zoom In", icon: <ZoomIn className="w-4 h-4" />, shortcut: "Ctrl++", onClick: onZoomIn, disabled: true },
    { label: "Zoom Out", icon: <ZoomIn className="w-4 h-4" />, shortcut: "Ctrl+-", onClick: onZoomOut, disabled: true },
    { divider: true },
    { label: "Theme Settings...", icon: <Palette className="w-4 h-4" />, disabled: true },
    { label: "Keyboard Shortcuts", icon: <Keyboard className="w-4 h-4" />, shortcut: "Ctrl+?", onClick: onShowShortcuts, disabled: true },
  ];

  // Cleanup consecutive and edge dividers
  const cleanDividers = (items: MenuItem[]): MenuItem[] => {
    let result = items.filter((item, i, arr) => {
      if (!('divider' in item)) return true;
      // Remove if: first item, last item, or previous item was also a divider
      if (i === 0) return false;
      if (i === arr.length - 1) return false;
      if ('divider' in arr[i - 1]) return false;
      return true;
    });
    // Also remove trailing dividers after filtering
    while (result.length > 0 && 'divider' in result[result.length - 1]) {
      result.pop();
    }
    return result;
  };

  // Filter items for upload screen
  const visibleFileItems = fileItems.filter(item => {
    if (!isUploadScreen) return true;
    if ('divider' in item) return true;
    return ['New Project', 'Open Draft...'].includes(item.label);
  });

  const visibleEditItems = editItems.filter(item => {
    if (!isUploadScreen) return true;
    if ('divider' in item) return true;
    return ['Global Settings...'].includes(item.label);
  });

  const visibleViewItems = viewItems.filter(item => {
    if (!isUploadScreen) return true;
    return false; // Hide View menu entirely on upload screen
  });

  // Apply separator cleanup to all visible item lists
  const cleanedFileItems = cleanDividers(visibleFileItems);
  const cleanedEditItems = cleanDividers(visibleEditItems);
  const cleanedViewItems = cleanDividers(visibleViewItems);

  return (
    <nav className="flex space-x-1 flex-1 items-center">
      <Menu label="File" items={cleanedFileItems} />
      <Menu label="Edit" items={cleanedEditItems} />
      {cleanedViewItems.length > 0 && <Menu label="View" items={cleanedViewItems} />}
    </nav>
  );
}
