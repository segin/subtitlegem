import React from 'react';
import { render, fireEvent, act, queryByText } from '@testing-library/react';
import { SubtitleTimeline } from './SubtitleTimeline';
import { SubtitleLine } from '@/types/subtitle';

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('SubtitleTimeline Virtualization', () => {
  const generateSubtitles = (count: number, duration: number): SubtitleLine[] => {
    const subs: SubtitleLine[] = [];
    const interval = duration / count;
    for (let i = 0; i < count; i++) {
      subs.push({
        id: `sub-${i}`,
        startTime: i * interval,
        endTime: i * interval + (interval * 0.9),
        text: `Subtitle ${i}`,
      });
    }
    return subs;
  };

  const defaultProps = {
    onSubtitlesUpdate: jest.fn(),
    duration: 1000, // 1000 seconds
    currentTime: 0,
    onSeek: jest.fn(),
    selectedIds: [],
    onSelect: jest.fn(),
    onSplit: jest.fn(),
  };

  it('renders only visible subtitles', () => {
    // 1000 subtitles over 1000 seconds = 1 sub per second
    const subtitles = generateSubtitles(1000, 1000);
    
    // Default pixelsPerSecond is 100.
    // Container width will be mocked.
    
    const { container, rerender } = render(
      <SubtitleTimeline 
        {...defaultProps} 
        subtitles={subtitles} 
      />
    );

    // Mock clientWidth and scrollLeft on the container
    const scrollContainer = container.querySelector('.overflow-x-auto');
    Object.defineProperty(scrollContainer, 'clientWidth', { configurable: true, value: 1000 });
    Object.defineProperty(scrollContainer, 'scrollLeft', { configurable: true, value: 0 });

    // Trigger update (since we just mocked properties, we might need to trigger event)
    // The component updates on mount, but our mock wasn't ready then.
    // Trigger scroll event to force update
    fireEvent.scroll(scrollContainer!);

    // With 1000px width and 100px/sec:
    // Viewport = 10s.
    // Buffer = 1000px = 10s (one screen each side).
    // Visible range: 0 - 20s (start is 0, end is 10 + 10 buffer).
    // Should render approx 20 subtitles (maybe 30 due to start buffer logic: max(0, -10) = 0).
    
    const renderedSubs = container.querySelectorAll('.border-l-2'); // Subtitle bubbles have specific border classes
    
    // Expect significantly fewer than 1000
    expect(renderedSubs.length).toBeLessThan(100);
    expect(renderedSubs.length).toBeGreaterThan(0);
  });

  it('updates rendered subtitles on scroll', () => {
    const subtitles = generateSubtitles(1000, 1000);
    const { container } = render(
      <SubtitleTimeline 
        {...defaultProps} 
        subtitles={subtitles} 
      />
    );

    const scrollContainer = container.querySelector('.overflow-x-auto') as HTMLElement;
    Object.defineProperty(scrollContainer, 'clientWidth', { configurable: true, value: 1000 });
    
    // Scroll to 5000px (50 seconds in)
    Object.defineProperty(scrollContainer, 'scrollLeft', { configurable: true, value: 5000 });
    fireEvent.scroll(scrollContainer);

    // Visible range roughly: 
    // Start pixel: 5000 - 1000 (buffer) = 4000px -> 40s
    // End pixel: 5000 + 1000 (width) + 1000 (buffer) = 7000px -> 70s
    // Should render subs around 40s - 70s.
    // Sub 45 should be visible. Sub 5 should NOT be visible.

    const subText5 = container.textContent?.includes('Subtitle 5');
    const subText45 = container.textContent?.includes('Subtitle 45'); // 45s
    
    // Subtitle 5 (5s-5.9s) should be out of view (range starts at 40s)
    // Subtitle 5 (5s-5.9s) should be out of view (range starts at 40s)
    // We use queryByText which matches full string by default, ensuring we don't match "Subtitle 50"
    const sub5 = queryByText(container, 'Subtitle 5');
    expect(sub5).toBeNull();
    
    // Subtitle 45 (45s-45.9s) should be in view
    const sub45 = queryByText(container, 'Subtitle 45');
    expect(sub45).not.toBeNull();
  });
});
