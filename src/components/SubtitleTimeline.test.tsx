import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubtitleTimeline } from './SubtitleTimeline';
import { SubtitleLine, VideoClip, TimelineClip } from '@/types/subtitle';

// Mock ResizeObserver
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('SubtitleTimeline', () => {
  const mockSubtitles: SubtitleLine[] = [
    { id: '1', startTime: 0, endTime: 5, text: 'Hello' },
    { id: '2', startTime: 6, endTime: 10, text: 'World' },
  ];

  const mockVideoClips: VideoClip[] = [
    { 
      id: 'v1', filePath: '/path/vid1.mp4', originalFilename: 'vid1.mp4', 
      duration: 60, width: 1920, height: 1080, subtitles: [], subtitleConfig: {} 
    }
  ];

  const mockTimelineClips: TimelineClip[] = [
    { 
      id: 'c1', videoClipId: 'v1', projectStartTime: 0, 
      sourceInPoint: 0, clipDuration: 10 
    }
  ];

  const defaultProps = {
    subtitles: mockSubtitles,
    onSubtitlesUpdate: jest.fn(),
    duration: 100,
    currentTime: 0,
    onSeek: jest.fn(),
    selectedIds: [],
    onSelect: jest.fn(),
    onSplit: jest.fn(),
  };

  it('renders correctly in legacy single-track mode', () => {
    // @ts-ignore - testing legacy props shape if needed, or just default props
    render(<SubtitleTimeline {...defaultProps} onUpdate={defaultProps.onSubtitlesUpdate} />);
    
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
    // Should NOT show VIDEO track
    expect(screen.queryByText('VIDEO')).not.toBeInTheDocument();
    expect(screen.getByText('SUBS')).toBeInTheDocument();
  });

  it('renders video track in multi-video mode', () => {
    render(
      <SubtitleTimeline 
        {...defaultProps}
        videoClips={mockVideoClips}
        timelineClips={mockTimelineClips}
        onTimelineClipsUpdate={jest.fn()}
      />
    );

    expect(screen.getByText('VIDEO')).toBeInTheDocument();
    expect(screen.getByText('vid1.mp4')).toBeInTheDocument();
  });

  it('handles zoom interactions', () => {
    render(
      <SubtitleTimeline 
        {...defaultProps}
        videoClips={mockVideoClips}
        timelineClips={mockTimelineClips}
      />
    );

    // Initial zoom text (approx 100% of 100px/s default)
    expect(screen.getByText('100%')).toBeInTheDocument();

    const zoomInBtn = screen.getByTitle('Zoom In (+)');
    fireEvent.click(zoomInBtn);

    // 100 * 1.2 = 120
    expect(screen.getByText('120%')).toBeInTheDocument();

    const zoomOutBtn = screen.getByTitle('Zoom Out (-)');
    fireEvent.click(zoomOutBtn); // 120 * 0.8 = 96
    
    expect(screen.getByText('96%')).toBeInTheDocument();
  });

  it('handles selection of subtitles', () => {
    const onSelect = jest.fn();
    render(<SubtitleTimeline {...defaultProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Hello'));
    expect(onSelect).toHaveBeenCalledWith('1', false);
  });

  it('handles clip selection in multi-video mode', () => {
    const onClipSelect = jest.fn();
    render(
      <SubtitleTimeline 
        {...defaultProps}
        videoClips={mockVideoClips}
        timelineClips={mockTimelineClips}
        onClipSelect={onClipSelect}
      />
    );

    fireEvent.click(screen.getByText('vid1.mp4'));
    expect(onClipSelect).toHaveBeenCalledWith('c1');
  });

  // Mocking getBoundingClientRect is messy in JSDOM, 
  // we primarily test that handlers are attached and fire logic.
});
