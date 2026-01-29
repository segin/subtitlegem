"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import { Menu, MenuItem, MenuItemBase } from "./ui/Menu";
import { 
  FileVideo, FolderOpen, Save, Download, X, RefreshCw,
  Undo2, Redo2, Scissors, Copy, ClipboardPaste, Search, 
  Merge, Split, Clock, PanelLeft, PanelBottom, 
  ZoomIn, ZoomOut, Palette, Keyboard, Settings, HelpCircle, ExternalLink, Info
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface RecentDraft {
  id: string;
  name: string;
  date: string;
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
  onThemeSettings?: () => void;
  hasSecondarySubtitles?: boolean;
  primaryLanguage?: string;
  secondaryLanguage?: string;
  isUploadScreen?: boolean;
  onToggleQueue?: () => void;
  onVideoProperties?: () => void;
  onToggleVideoLibrary?: () => void;
  // Cut/Copy/Paste/Merge/Split
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onMerge?: () => void;
  onSplit?: () => void;
  hasSelection?: boolean;
  hasClipboard?: boolean;
  canMerge?: boolean;
  canSplit?: boolean;
  // Recent Drafts
  recentDrafts?: RecentDraft[];
  onLoadDraft?: (id: string) => void;
  onAbout?: () => void;
  // Toggle states for checkmarks
  isTimelineVisible?: boolean;
  isSubtitleListVisible?: boolean;
  onToggleSecondaryTracks?: () => void;
  isSecondaryTracksVisible?: boolean;
  isVideoLibraryVisible?: boolean;
}

// ============================================================================
// Helper: Clean consecutive/edge dividers
// ============================================================================

function cleanDividers(items: MenuItem[]): MenuItem[] {
  let result = items.filter((item, i, arr) => {
    if (!('divider' in item)) return true;
    if (i === 0) return false;
    if (i === arr.length - 1) return false;
    if ('divider' in arr[i - 1]) return false;
    return true;
  });
  while (result.length > 0 && 'divider' in result[result.length - 1]) {
    result.pop();
  }
  return result;
}

// ============================================================================
// MenuBar Component
// ============================================================================

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
  onThemeSettings,
  hasSecondarySubtitles = false,
  primaryLanguage = 'English',
  secondaryLanguage = 'Secondary',
  isUploadScreen = false,
  onToggleQueue,
  onVideoProperties,
  onToggleVideoLibrary,
  isTimelineVisible,
  isSubtitleListVisible,
  isVideoLibraryVisible,
  onCut, onCopy, onPaste, onMerge, onSplit,
  hasSelection = false, hasClipboard = false, canMerge = false, canSplit = false,
  recentDrafts = [], onLoadDraft, onAbout,
  onToggleSecondaryTracks, isSecondaryTracksVisible
}: MenuBarProps) {
  
  // Track which menu is open (for cross-menu navigation)
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);
  
  // Refs for menu triggers (for keyboard focus management)
  const fileTriggerRef = useRef<HTMLButtonElement>(null);
  const editTriggerRef = useRef<HTMLButtonElement>(null);
  const viewTriggerRef = useRef<HTMLButtonElement>(null);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = [fileTriggerRef, editTriggerRef, viewTriggerRef, helpTriggerRef];
  const menuCount = isUploadScreen ? 3 : 4; // File, Edit, View (if shown), Help

  const isAnyMenuOpen = activeMenuIndex !== null;

  const handleNavigateLeft = useCallback((currentIndex: number) => {
    let prevIndex = (currentIndex - 1 + menuCount) % menuCount;
    // Skip View menu if on upload screen
    if (isUploadScreen && prevIndex === 2) {
      prevIndex = 1; // Skip to Edit
    }
    setActiveMenuIndex(prevIndex);
    // Focus the adjacent trigger
    requestAnimationFrame(() => {
      triggerRefs[prevIndex]?.current?.focus();
    });
  }, [isUploadScreen, triggerRefs]);

  const handleNavigateRight = useCallback((currentIndex: number) => {
    let nextIndex = (currentIndex + 1) % menuCount;
    // Skip View menu if on upload screen
    if (isUploadScreen && nextIndex === 2) {
      nextIndex = 0; // Wrap to File
    }
    setActiveMenuIndex(nextIndex);
    // Focus the adjacent trigger
    requestAnimationFrame(() => {
      triggerRefs[nextIndex]?.current?.focus();
    });
  }, [isUploadScreen, triggerRefs]);

  // ========== FILE MENU ==========
  const fileItems = useMemo<MenuItem[]>(() => {
    const items: MenuItem[] = [
      { id: "new", label: "New Project", icon: <FileVideo className="w-4 h-4" />, onClick: onNewProject, shortcut: "Shift+N" },
      { id: "open", label: "Open Project...", icon: <FolderOpen className="w-4 h-4" />, onClick: onOpenProject, shortcut: "Ctrl+O" },
      { id: "open-draft", label: "Open Draft", icon: <FolderOpen className="w-4 h-4" />, 
        items: recentDrafts.length > 0 ? recentDrafts.map(d => ({
          id: `draft-${d.id}`,
          label: d.name,
          onClick: () => onLoadDraft?.(d.id),
        })) : [{ id: "no-drafts", label: "No Recent Drafts", disabled: true }]
      },
      { id: "save-project", label: "Save Project", icon: <Save className="w-4 h-4" />, onClick: onSaveProject, shortcut: "Ctrl+S", showOnUploadScreen: false },
      { divider: true },
      { id: "save-draft", label: "Save Draft", icon: <Save className="w-4 h-4" />, onClick: onSaveDraft, showOnUploadScreen: false },
      { divider: true },
      { id: "export-ass", label: "Export Project (.ass)", icon: <Download className="w-4 h-4" />, onClick: () => onExport?.('ass'), showOnUploadScreen: false },
      { 
        id: "export-srt-primary",
        label: hasSecondarySubtitles ? `Export ${primaryLanguage} (.srt)` : "Export Subtitles (.srt)", 
        icon: <Download className="w-4 h-4" />, 
        onClick: () => onExport?.(hasSecondarySubtitles ? 'srt-primary' : 'srt'),
        showOnUploadScreen: false
      },
    ];

    if (hasSecondarySubtitles) {
      items.push({
        id: "export-srt-secondary",
        label: `Export ${secondaryLanguage} (.srt)`, 
        icon: <Download className="w-4 h-4" />, 
        onClick: () => onExport?.('srt-secondary'),
        showOnUploadScreen: false
      });
    }

    items.push(
      { id: "export-txt", label: "Export Transcript (.txt)", icon: <Download className="w-4 h-4" />, onClick: () => onExport?.('txt'), showOnUploadScreen: false },
      { divider: true },
      { id: "reprocess", label: "Reprocess Video...", icon: <RefreshCw className="w-4 h-4" />, onClick: onReprocessVideo, showOnUploadScreen: false },
      { id: "close-project", label: "Close Project", icon: <X className="w-4 h-4" />, onClick: onCloseProject, showOnUploadScreen: false }
    );

    return items;
  }, [onNewProject, onOpenProject, onSaveProject, onOpenDraft, onSaveDraft, onExport, onReprocessVideo, onCloseProject, hasSecondarySubtitles, primaryLanguage, secondaryLanguage, isUploadScreen, recentDrafts, onLoadDraft]);

  // ========== EDIT MENU ==========
  const editItems = useMemo<MenuItem[]>(() => [
    { id: "undo", label: "Undo", icon: <Undo2 className="w-4 h-4" />, shortcut: "Ctrl+Z", onClick: onUndo, disabled: !canUndo || isUploadScreen, showOnUploadScreen: false },
    { id: "redo", label: "Redo", icon: <Redo2 className="w-4 h-4" />, shortcut: "Ctrl+Y", onClick: onRedo, disabled: !canRedo || isUploadScreen, showOnUploadScreen: false },
    { divider: true },
    { id: "cut", label: "Cut", icon: <Scissors className="w-4 h-4" />, shortcut: "Ctrl+X", onClick: onCut, disabled: !hasSelection || isUploadScreen, showOnUploadScreen: false },
    { id: "copy", label: "Copy", icon: <Copy className="w-4 h-4" />, shortcut: "Ctrl+C", onClick: onCopy, disabled: !hasSelection || isUploadScreen, showOnUploadScreen: false },
    { id: "paste", label: "Paste", icon: <ClipboardPaste className="w-4 h-4" />, shortcut: "Ctrl+V", onClick: onPaste, disabled: !hasClipboard || isUploadScreen, showOnUploadScreen: false },
    { divider: true },
    { id: "find-replace", label: "Find & Replace...", icon: <Search className="w-4 h-4" />, shortcut: "Ctrl+H", onClick: onFindReplace, disabled: isUploadScreen, showOnUploadScreen: false },
    { divider: true },
    { id: "merge", label: "Merge Subtitles", icon: <Merge className="w-4 h-4" />, onClick: onMerge, disabled: !canMerge || isUploadScreen, showOnUploadScreen: false },
    { id: "split", label: "Split Subtitle", icon: <Split className="w-4 h-4" />, onClick: onSplit, disabled: !canSplit || isUploadScreen, showOnUploadScreen: false },
    { id: "shift-timings", label: "Shift All Timings...", icon: <Clock className="w-4 h-4" />, onClick: onShiftTimings, disabled: isUploadScreen, showOnUploadScreen: false },
    { divider: true },
    { id: "project-settings", label: "Project Settings...", icon: <Settings className="w-4 h-4" />, onClick: onProjectSettings, disabled: isUploadScreen, showOnUploadScreen: false },
    { divider: true },
    { id: "global-settings", label: "Global Settings...", icon: <Settings className="w-4 h-4" />, onClick: onGlobalSettings, showOnUploadScreen: true },
  ], [onUndo, onRedo, canUndo, canRedo, onFindReplace, onShiftTimings, onProjectSettings, onGlobalSettings, isUploadScreen, onCut, onCopy, onPaste, onMerge, onSplit, hasSelection, hasClipboard, canMerge, canSplit]);

  // ========== VIEW MENU ==========
  const viewItems = useMemo<MenuItem[]>(() => [
    { id: "video-assets", label: "Asset Library", icon: <FileVideo className="w-4 h-4" />, onClick: onToggleVideoLibrary, disabled: isUploadScreen, checked: isVideoLibraryVisible },
    { id: "video-props", label: "Video Properties...", icon: <FileVideo className="w-4 h-4" />, onClick: onVideoProperties, disabled: isUploadScreen },
    { divider: true },
    { id: "toggle-timeline", label: "Toggle Timeline", icon: <PanelBottom className="w-4 h-4" />, onClick: onToggleTimeline, disabled: isUploadScreen, checked: isTimelineVisible },
    { id: "toggle-subtitle-list", label: "Toggle Subtitle List", icon: <PanelLeft className="w-4 h-4" />, onClick: onToggleSubtitleList, disabled: isUploadScreen, checked: isSubtitleListVisible },
    { id: "toggle-secondary-tracks", label: "Show Secondary Tracks (V2)", icon: <PanelBottom className="w-4 h-4" />, onClick: onToggleSecondaryTracks, disabled: isUploadScreen, checked: isSecondaryTracksVisible },
    { divider: true },
    { id: "zoom-in", label: "Zoom In", icon: <ZoomIn className="w-4 h-4" />, shortcut: "Ctrl++", onClick: onZoomIn, disabled: isUploadScreen },
    { id: "zoom-out", label: "Zoom Out", icon: <ZoomOut className="w-4 h-4" />, shortcut: "Ctrl+-", onClick: onZoomOut, disabled: isUploadScreen },
    { divider: true },
    { id: "theme", label: "Theme Settings...", icon: <Palette className="w-4 h-4" />, onClick: onThemeSettings, disabled: isUploadScreen },
    { id: "shortcuts", label: "Keyboard Shortcuts", icon: <Keyboard className="w-4 h-4" />, shortcut: "Ctrl+?", onClick: onShowShortcuts },
  ], [onToggleVideoLibrary, onVideoProperties, onToggleTimeline, onToggleSubtitleList, onToggleSecondaryTracks, onZoomIn, onZoomOut, onShowShortcuts, isUploadScreen, isVideoLibraryVisible, isTimelineVisible, isSubtitleListVisible, isSecondaryTracksVisible]);

  // ========== FILTER FOR UPLOAD SCREEN ==========
  const filterForUploadScreen = useCallback((items: MenuItem[]): MenuItem[] => {
    if (!isUploadScreen) return items;
    return items.filter(item => {
      if ('divider' in item) return true;
      return (item as MenuItemBase).showOnUploadScreen === true;
    });
  }, [isUploadScreen]);

  const cleanedFileItems = useMemo(() => cleanDividers(filterForUploadScreen(fileItems)), [fileItems, filterForUploadScreen]);
  const cleanedEditItems = useMemo(() => cleanDividers(filterForUploadScreen(editItems)), [editItems, filterForUploadScreen]);
  const cleanedViewItems = useMemo(() => cleanDividers(filterForUploadScreen(viewItems)), [viewItems, filterForUploadScreen]);

  // ========== HELP MENU ==========
  const helpItems = useMemo<MenuItem[]>(() => [
    { id: "documentation", label: "Documentation", icon: <ExternalLink className="w-4 h-4" />, onClick: () => window.open('https://github.com/segin/subtitlegem#readme', '_blank') },
    { divider: true },
    { id: "shortcuts-help", label: "Keyboard Shortcuts", icon: <Keyboard className="w-4 h-4" />, shortcut: "Ctrl+?", onClick: onShowShortcuts },
    { divider: true },
    { id: "about", label: "About SubtitleGem", icon: <Info className="w-4 h-4" />, onClick: onAbout },
  ], [onShowShortcuts, onAbout]);
  const cleanedHelpItems = useMemo(() => cleanDividers(helpItems), [helpItems]);

  return (
    <nav className="flex space-x-1 flex-1 items-center">
      <Menu 
        label="File" 
        items={cleanedFileItems}
        isOpen={activeMenuIndex === 0}
        onOpenChange={(open) => setActiveMenuIndex(open ? 0 : null)}
        onNavigateLeft={() => handleNavigateLeft(0)}
        onNavigateRight={() => handleNavigateRight(0)}
        isAnyMenuOpen={isAnyMenuOpen}
        triggerRef={fileTriggerRef}
      />
      <Menu 
        label="Edit" 
        items={cleanedEditItems}
        isOpen={activeMenuIndex === 1}
        onOpenChange={(open) => setActiveMenuIndex(open ? 1 : null)}
        onNavigateLeft={() => handleNavigateLeft(1)}
        onNavigateRight={() => handleNavigateRight(1)}
        isAnyMenuOpen={isAnyMenuOpen}
        triggerRef={editTriggerRef}
      />
      {cleanedViewItems.length > 0 && (
        <Menu 
          label="View" 
          items={cleanedViewItems}
          isOpen={activeMenuIndex === 2}
          onOpenChange={(open) => setActiveMenuIndex(open ? 2 : null)}
          onNavigateLeft={() => handleNavigateLeft(2)}
          onNavigateRight={() => handleNavigateRight(2)}
          isAnyMenuOpen={isAnyMenuOpen}
          triggerRef={viewTriggerRef}
        />
      )}
      <Menu 
        label="Help" 
        items={cleanedHelpItems}
        isOpen={activeMenuIndex === 3}
        onOpenChange={(open) => setActiveMenuIndex(open ? 3 : null)}
        onNavigateLeft={() => handleNavigateLeft(3)}
        onNavigateRight={() => handleNavigateRight(3)}
        isAnyMenuOpen={isAnyMenuOpen}
        triggerRef={helpTriggerRef}
      />
    </nav>
  );
}
