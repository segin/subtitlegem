"use client";

import { useState, useCallback, useRef } from "react";
import { SubtitleLine } from "@/types/subtitle";

const MAX_HISTORY_SIZE = 50;

export interface UseSubtitleHistoryReturn {
  subtitles: SubtitleLine[];
  setSubtitles: (newSubtitles: SubtitleLine[] | ((prev: SubtitleLine[]) => SubtitleLine[])) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  resetHistory: (initialState: SubtitleLine[]) => void;
}

/**
 * Custom hook for managing subtitle state with undo/redo functionality.
 * Uses a history stack pattern for efficient state management.
 */
export function useSubtitleHistory(initialSubtitles: SubtitleLine[] = []): UseSubtitleHistoryReturn {
  // Current state
  const [subtitles, setSubtitlesInternal] = useState<SubtitleLine[]>(initialSubtitles);
  
  // History stacks
  const undoStack = useRef<SubtitleLine[][]>([]);
  const redoStack = useRef<SubtitleLine[][]>([]);
  
  // Track if we can undo/redo (for UI)
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /**
   * Set subtitles with history tracking
   */
  const setSubtitles = useCallback((newSubtitles: SubtitleLine[] | ((prev: SubtitleLine[]) => SubtitleLine[])) => {
    setSubtitlesInternal(prev => {
      const resolved = typeof newSubtitles === 'function' ? newSubtitles(prev) : newSubtitles;
      
      // Don't track if subtitles haven't actually changed
      if (JSON.stringify(prev) === JSON.stringify(resolved)) {
        return prev;
      }
      
      // Push current state to undo stack
      undoStack.current.push(prev);
      if (undoStack.current.length > MAX_HISTORY_SIZE) {
        undoStack.current.shift(); // Remove oldest entry
      }
      
      // Clear redo stack on new action
      redoStack.current = [];
      
      // Update can flags
      setCanUndo(true);
      setCanRedo(false);
      
      return resolved;
    });
  }, []);

  /**
   * Undo the last action
   */
  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    
    const previousState = undoStack.current.pop()!;
    
    setSubtitlesInternal(current => {
      // Push current to redo stack
      redoStack.current.push(current);
      
      // Update can flags
      setCanUndo(undoStack.current.length > 0);
      setCanRedo(true);
      
      return previousState;
    });
  }, []);

  /**
   * Redo the last undone action
   */
  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    
    const nextState = redoStack.current.pop()!;
    
    setSubtitlesInternal(current => {
      // Push current to undo stack
      undoStack.current.push(current);
      
      // Update can flags
      setCanUndo(true);
      setCanRedo(redoStack.current.length > 0);
      
      return nextState;
    });
  }, []);

  /**
   * Reset history with a new initial state (used when loading projects)
   */
  const resetHistory = useCallback((initialState: SubtitleLine[]) => {
    undoStack.current = [];
    redoStack.current = [];
    setSubtitlesInternal(initialState);
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return {
    subtitles,
    setSubtitles,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
  };
}
