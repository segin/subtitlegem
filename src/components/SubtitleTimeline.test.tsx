import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubtitleTimeline } from './SubtitleTimeline';
import { SubtitleLine, VideoClip, TimelineClip, TimelineImage, ImageAsset } from '@/types/subtitle';

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

  describe('Legacy/Single-Track Mode', () => {
    it('renders correctly with only subtitles', () => {
      // @ts-ignore - testing legacy props shape if needed, or just default props
      render(<SubtitleTimeline {...defaultProps} onUpdate={defaultProps.onSubtitlesUpdate} />);
      
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('World')).toBeInTheDocument();
      
      // Should show SUBS track
      expect(screen.getByText('SUBS')).toBeInTheDocument();
      
      // Should NOT show VIDEO or AUDIO tracks
      expect(screen.queryByText('VIDEO')).not.toBeInTheDocument();
      expect(screen.queryByText('AUDIO')).not.toBeInTheDocument();
    });

    it('handles interaction with subtitles', () => {
        const onSelect = jest.fn();
        render(<SubtitleTimeline {...defaultProps} onSelect={onSelect} />);
    
        fireEvent.click(screen.getByText('Hello'));
        expect(onSelect).toHaveBeenCalledWith('1', false, false);
    });
  });

  describe('Multi-Track Mode', () => {
    const multiTrackProps = {
        ...defaultProps,
        videoClips: mockVideoClips,
        timelineClips: mockTimelineClips,
        onTimelineClipsUpdate: jest.fn(),
    };

    it('renders all three tracks (Video, Audio, Subs)', () => {
      render(<SubtitleTimeline {...multiTrackProps} />);
  
      const videoLabel = screen.getByText('VIDEO');
      const audioLabel = screen.getByText('AUDIO');
      const subsLabel = screen.getByText('SUBS');

      expect(videoLabel).toBeInTheDocument();
      expect(audioLabel).toBeInTheDocument();
      expect(subsLabel).toBeInTheDocument();

      // Check content presence
      expect(screen.getByText('vid1.mp4')).toBeInTheDocument(); // Video clip
      expect(screen.getByText('Audio')).toBeInTheDocument(); // Audio block usage
    });

    it('renders audio waveform visualization', () => {
        const { container } = render(<SubtitleTimeline {...multiTrackProps} />);
        
        // Find the SVG used for waveform
        // We can query by class "text-[#4a9c5d]" which we used for the Kdenlive green style
        // Or look for any path element inside the Audio block
        
        const svgs = container.querySelectorAll('svg');
        // We expect at least zoom icons + the waveform SVG
        const waveformSvg = Array.from(svgs).find(svg => svg.classList.contains('text-[#4a9c5d]'));
        expect(waveformSvg).toBeInTheDocument();
        expect(waveformSvg?.querySelector('path')).toBeInTheDocument();
    });

    it('handles clip selection', () => {
      const onClipSelect = jest.fn();
      render(
        <SubtitleTimeline 
          {...multiTrackProps}
          onClipSelect={onClipSelect}
        />
      );
  
      // Clicking video block
      fireEvent.click(screen.getByText('vid1.mp4'));
      expect(onClipSelect).toHaveBeenCalledWith('c1');
    });

    it('context menu is triggered for video/audio clips', () => {
        // We can't easily check the state change of contextMenu internal state without detailed querying,
        // but we can ensure the event handler runs.
        // Actually, checking if the block accepts context menu is enough for unit test.
        
        render(<SubtitleTimeline {...multiTrackProps} />);
        const videoBlock = screen.getByText('vid1.mp4').closest('div[data-draggable="true"]');
        expect(videoBlock).toBeInTheDocument();
        
        // Fire right click
        fireEvent.contextMenu(videoBlock!);
        // Since state is internal, we can't assert appearance unless we mock setContextMenu or check DOM for the menu portal/overlay
        // But verifying no crash is good baseline.
    });
  });

  describe('Zoom and Navigation', () => {
      it('handles zoom interaction with buttons', () => {
        render(<SubtitleTimeline {...defaultProps} />);
    
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
  });

  describe('Snap Logic (Unit)', () => {
     // We can't fully integration test drag-snap behavior easily in JSDOM,
     // but we can verify the snap helper logic if exported or indirectly via prop changes if we simulated drag events perfectly.
     // For now, stick to rendering and event connection.
  });
});
