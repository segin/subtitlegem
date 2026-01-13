"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  SubtitleConfig, 
  DEFAULT_CONFIG, 
  VideoClip, 
  TimelineClip, 
  TimelineImage, 
  ImageAsset, 
  DEFAULT_PROJECT_CONFIG,
  ProjectConfig,
  SubtitleLine,
} from '@/types/subtitle';
import { QueueItem } from '@/lib/queue-manager';
import { VideoProperties } from '@/components/VideoPropertiesDialog';
import { UploadMode } from '@/components/VideoUpload';
import { TabId } from '@/components/GlobalSettingsDialog';
import { useSubtitleHistory } from './useSubtitleHistory';
import { getProjectDuration } from '@/lib/timeline-utils';
import { TimelineRef } from '@/components/SubtitleTimeline';

export interface DraftItem {
  id: string;
  name: string;
  videoPath?: string;
  createdAt: string;
  updatedAt: string;
  cache_summary?: string;
  metrics?: {
    sourceSize: number;
    renderedSize: number;
    sourceCount: number;
    subtitleCount: number;
    renderCount: number;
    lifetimeRenderCount: number;
  };
}

export interface RawSubtitleItem {
  startTime: string;
  endTime: string;
  text: string;
  secondaryText?: string;
}

/**
 * Dialog state management - groups all show* booleans for dialogs
 */
export function useDialogState() {
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [globalSettingsTab, setGlobalSettingsTab] = useState<TabId>('styles');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showShiftTimings, setShowShiftTimings] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showVideoProperties, setShowVideoProperties] = useState(false);
  const [showVideoLibrary, setShowVideoLibrary] = useState(false);
  const [showQueue, setShowQueue] = useState(true);
  const [showRestoreOption, setShowRestoreOption] = useState(false);

  return {
    showProjectSettings, setShowProjectSettings,
    showGlobalSettings, setShowGlobalSettings,
    globalSettingsTab, setGlobalSettingsTab,
    showShortcuts, setShowShortcuts,
    showAbout, setShowAbout,
    showShiftTimings, setShowShiftTimings,
    showFindReplace, setShowFindReplace,
    showVideoProperties, setShowVideoProperties,
    showVideoLibrary, setShowVideoLibrary,
    showQueue, setShowQueue,
    showRestoreOption, setShowRestoreOption,
  };
}

/**
 * Queue state management
 */
export function useQueueState() {
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queuePaused, setQueuePaused] = useState(false);
  const [queueWidth, setQueueWidth] = useState(300);

  // Load persisted queue width
  useEffect(() => {
    const savedWidth = localStorage.getItem('subtitlegem_queue_width');
    if (savedWidth) {
      const w = parseInt(savedWidth);
      if (!isNaN(w) && w >= 250 && w <= 600) setQueueWidth(w);
    }
  }, []);

  const handleQueueWidthChange = useCallback((w: number) => {
    setQueueWidth(w);
    localStorage.setItem('subtitlegem_queue_width', w.toString());
  }, []);

  // Real-time queue updates via Polling
  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/queue');
      if (res.ok) {
        const data = await res.json();
        setQueueItems(data.items);
        setQueuePaused(data.isPaused);
      }
    } catch (error) {
      console.error("Queue poll failed:", error);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 1000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const toggleQueuePause = useCallback(async () => {
    const action = queuePaused ? 'resume' : 'pause';
    await fetch('/api/queue', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    setQueuePaused(!queuePaused);
  }, [queuePaused]);

  return {
    queueItems, setQueueItems,
    queuePaused, setQueuePaused,
    queueWidth, setQueueWidth,
    handleQueueWidthChange,
    toggleQueuePause,
    fetchQueue,
  };
}

/**
 * Draft state management
 */
export function useDraftsState() {
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const res = await fetch('/api/drafts');
      const data = await res.json();
      setDrafts(data.drafts || []);
    } catch (err) {
      console.error('Failed to load drafts:', err);
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const handleDeleteDraft = useCallback(async (id: string) => {
    try {
      await fetch(`/api/drafts?id=${id}`, { method: 'DELETE' });
      setDrafts(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error('Failed to delete draft:', err);
    }
  }, []);

  return {
    drafts, setDrafts,
    draftsLoading,
    currentDraftId, setCurrentDraftId,
    fetchDrafts,
    handleDeleteDraft,
  };
}

/**
 * Video properties state management
 */
export function useVideoPropertiesState() {
  const [videoProperties, setVideoProperties] = useState<VideoProperties | null>(null);
  const [videoPropsLoading, setVideoPropsLoading] = useState(false);
  const [videoPropsError, setVideoPropsError] = useState<string | undefined>(undefined);

  const fetchVideoProperties = useCallback(async (videoPath: string | null) => {
    if (!videoPath) {
      setVideoPropsError('No video loaded');
      return;
    }

    // Use cached if available
    if (videoProperties) return;

    setVideoPropsLoading(true);
    setVideoPropsError(undefined);

    try {
      const res = await fetch(`/api/video-info?path=${encodeURIComponent(videoPath)}`);
      const data = await res.json();
      if (data.error) {
        setVideoPropsError(data.error);
      } else {
        setVideoProperties(data);
      }
    } catch (err: unknown) {
      setVideoPropsError((err instanceof Error ? err.message : String(err)) || 'Failed to fetch video properties');
    } finally {
      setVideoPropsLoading(false);
    }
  }, [videoProperties]);

  const clearVideoProperties = useCallback(() => {
    setVideoProperties(null);
    setVideoPropsError(undefined);
  }, []);

  return {
    videoProperties, setVideoProperties,
    videoPropsLoading, setVideoPropsLoading,
    videoPropsError, setVideoPropsError,
    fetchVideoProperties,
    clearVideoProperties,
  };
}

/**
 * Multi-video project state management
 */
export function useMultiVideoState() {
  const [videoClips, setVideoClips] = useState<VideoClip[]>([]);
  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([]);
  const [timelineImages, setTimelineImages] = useState<TimelineImage[]>([]);
  const [imageAssets, setImageAssets] = useState<ImageAsset[]>([]);
  const [projectConfig, setProjectConfig] = useState<ProjectConfig>(DEFAULT_PROJECT_CONFIG);
  const [uploadMode, setUploadMode] = useState<UploadMode>('single');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(false);

  const isMultiVideoMode = videoClips.length > 1 || uploadMode === 'multi-video';

  // Timeline Zoom Ref
  const timelineRef = useRef<TimelineRef>(null);

  return {
    videoClips, setVideoClips,
    timelineClips, setTimelineClips,
    timelineImages, setTimelineImages,
    imageAssets, setImageAssets,
    projectConfig, setProjectConfig,
    uploadMode, setUploadMode,
    selectedClipId, setSelectedClipId,
    selectedImageId, setSelectedImageId,
    isLibraryCollapsed, setIsLibraryCollapsed,
    isMultiVideoMode,
    timelineRef,
  };
}

/**
 * Selection and clipboard state
 */
export function useSelectionState() {
  const [selectedSubtitleIds, setSelectedSubtitleIds] = useState<string[]>([]);
  const [clipboardSubtitles, setClipboardSubtitles] = useState<SubtitleLine[]>([]);
  const lastSelectedIdRef = useRef<string | null>(null);

  return {
    selectedSubtitleIds, setSelectedSubtitleIds,
    clipboardSubtitles, setClipboardSubtitles,
    lastSelectedIdRef,
  };
}

/**
 * Core state management
 */
export function useCoreState() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [config, setConfig] = useState<SubtitleConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'style'>('list');
  const [initialSubtitles, setInitialSubtitles] = useState<SubtitleLine[] | null>(null);

  const resetCoreState = useCallback(() => {
    setVideoUrl(null);
    setVideoPath(null);
    setDuration(0);
    setCurrentTime(0);
    setConfig(DEFAULT_CONFIG);
    setInitialSubtitles(null);
  }, []);

  return {
    videoUrl, setVideoUrl,
    videoPath, setVideoPath,
    duration, setDuration,
    currentTime, setCurrentTime,
    config, setConfig,
    loading, setLoading,
    activeTab, setActiveTab,
    initialSubtitles, setInitialSubtitles,
    resetCoreState,
  };
}

/**
 * Unified Home State Hook
 */
export function useHomeState() {
  const core = useCoreState();
  const dialogs = useDialogState();
  const queue = useQueueState();
  const drafts = useDraftsState();
  const videoProperties = useVideoPropertiesState();
  const multiVideo = useMultiVideoState();
  const selection = useSelectionState();
  const history = useSubtitleHistory([]);

  return {
    ...core,
    ...dialogs,
    ...queue,
    ...drafts,
    ...videoProperties,
    ...multiVideo,
    ...selection,
    ...history,
  };
}
