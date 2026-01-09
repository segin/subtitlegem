import { renderHook, act } from '@testing-library/react';
import { useSubtitleHistory } from './useSubtitleHistory';
import { SubtitleLine } from '@/types/subtitle';

describe('useSubtitleHistory', () => {
    const initialSubtitles: SubtitleLine[] = [
        { id: '1', startTime: 0, endTime: 1000, text: 'Hello' }
    ];

    it('should initialize with provided subtitles', () => {
        const { result } = renderHook(() => useSubtitleHistory(initialSubtitles));
        expect(result.current.subtitles).toEqual(initialSubtitles);
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);
    });

    it('should track changes in history', () => {
        const { result } = renderHook(() => useSubtitleHistory(initialSubtitles));
        
        const newSubtitles = [...initialSubtitles, { id: '2', startTime: 1000, endTime: 2000, text: 'World' }];
        
        act(() => {
            result.current.setSubtitles(newSubtitles);
        });

        expect(result.current.subtitles).toEqual(newSubtitles);
        expect(result.current.canUndo).toBe(true);
    });

    it('should undo changes', () => {
        const { result } = renderHook(() => useSubtitleHistory(initialSubtitles));
        const newSubtitles = [...initialSubtitles, { id: '2', text: 'World', startTime: 1000, endTime: 2000 }];
        
        act(() => {
            result.current.setSubtitles(newSubtitles);
        });

        act(() => {
            result.current.undo();
        });

        expect(result.current.subtitles).toEqual(initialSubtitles);
        expect(result.current.canRedo).toBe(true);
    });

    it('should reset history correctly', () => {
        const { result } = renderHook(() => useSubtitleHistory(initialSubtitles));
        const newSubtitles = [...initialSubtitles, { id: '2', text: 'New', startTime: 1000, endTime: 2000 }];
        
        // Make some changes
        act(() => {
            result.current.setSubtitles(newSubtitles);
        });

        expect(result.current.canUndo).toBe(true);
        
        // Reset
        act(() => {
            result.current.resetHistory([]);
        });

        expect(result.current.subtitles).toEqual([]);
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);
    });

    it('should clear redo stack when a new change is made', () => {
        const { result } = renderHook(() => useSubtitleHistory(initialSubtitles));
        const step1 = [...initialSubtitles, { id: '2', text: 'Step 1', startTime: 0, endTime: 1 }];
        const step2 = [...initialSubtitles, { id: '3', text: 'Step 2', startTime: 0, endTime: 1 }];

        act(() => result.current.setSubtitles(step1));
        act(() => result.current.undo());
        
        expect(result.current.canRedo).toBe(true);

        // Make new change
        act(() => result.current.setSubtitles(step2));

        expect(result.current.subtitles).toEqual(step2);
        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRedo).toBe(false); // Redo stack cleared
    });

    it('should respect max history size', () => {
        const { result } = renderHook(() => useSubtitleHistory(initialSubtitles));
        
        // Add 60 changes (Max is 50)
        for (let i = 0; i < 60; i++) {
            act(() => {
                result.current.setSubtitles([{ id: '1', text: `Change ${i}`, startTime: 0, endTime: 10 }]);
            });
        }

        expect(result.current.canUndo).toBe(true);
        
        // Undo 50 times
        for (let i = 0; i < 50; i++) {
             act(() => result.current.undo());
        }
        
        // Should be at limit, can't undo further to the very original state if it fell off stack
        // Stack size is 50. We pushed 60. 
        // 0..49 = 50 items. original state pushed deep.
        // Actually MAX_HISTORY_SIZE = 50 in implementation.
        expect(result.current.canUndo).toBe(false); 
    });

    it('should ignores updates that do not change content', () => {
        const { result } = renderHook(() => useSubtitleHistory(initialSubtitles));
        
        act(() => {
            // Set same content
            result.current.setSubtitles([...initialSubtitles]);
        });

        expect(result.current.canUndo).toBe(false); // No history entry added
    });
});
