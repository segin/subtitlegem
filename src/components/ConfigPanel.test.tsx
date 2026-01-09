import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigPanel } from './ConfigPanel';
import { SubtitleConfig } from '@/types/subtitle';
import '@testing-library/jest-dom';

const mockConfig: SubtitleConfig = {
    primary: { 
        fontSize: 20, 
        color: '#ffffff', 
        backgroundColor: '#000000',
        fontFamily: 'Arial, sans-serif',
        alignment: 2,
        marginV: 10,
        marginH: 10,
        outlineWidth: 1,
        outlineColor: '#000000',
        spacing: 0,
        angle: 0,
        borderStyle: 1,
        shadowDist: 0,
        shadowColor: '#000000'
    },
    secondary: { 
        fontSize: 18, 
        color: '#aaaaaa',
        backgroundColor: '#000000',
        fontFamily: 'Arial, sans-serif',
        alignment: 2,
        marginV: 5,
        marginH: 5,
        outlineWidth: 1,
        outlineColor: '#000000',
        spacing: 0,
        angle: 0,
        borderStyle: 1,
        shadowDist: 0,
        shadowColor: '#000000'
    },
    ffmpeg: { 
        hwaccel: 'none', 
        crf: 23, 
        preset: 'medium',
        audioBitrate: '192k', // legacy fields if any
        videoBitrate: '2M'
    }
} as any; // Type casting to avoid exhaustive mock of every field if interface is huge

describe('ConfigPanel', () => {
  const onChange = jest.fn();

  beforeEach(() => {
    onChange.mockClear();
  });

  test('renders primary tab by default', () => {
    render(<ConfigPanel config={mockConfig} onChange={onChange} />);
    expect(screen.getByText('Primary').closest('button')).toHaveClass('bg-[#3e3e42]');
    // Check for a primary field value
    expect(screen.getByDisplayValue(20)).toBeInTheDocument(); // fontSize 20
  });

  test('switches tabs', () => {
    render(<ConfigPanel config={mockConfig} onChange={onChange} />);
    
    fireEvent.click(screen.getByText('Secondary'));
    expect(screen.getByText('Secondary').closest('button')).toHaveClass('bg-[#3e3e42]');
    // Check secondary field
    expect(screen.getByDisplayValue(18)).toBeInTheDocument(); // fontSize 18

    fireEvent.click(screen.getByText('Encoding'));
    expect(screen.getByText('Encoding').closest('button')).toHaveClass('bg-[#3e3e42]');
    // Check encoding field
    expect(screen.getByDisplayValue(23)).toBeInTheDocument(); // crf 23
  });

  test('updates style value', () => {
    render(<ConfigPanel config={mockConfig} onChange={onChange} />);
    
    // Change font size
    const sizeInput = screen.getByDisplayValue(20);
    fireEvent.change(sizeInput, { target: { value: '25' } });
    
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        primary: expect.objectContaining({ fontSize: 25 })
    }));
  });

  test('updates encoding config', () => {
    render(<ConfigPanel config={mockConfig} onChange={onChange} />);
    fireEvent.click(screen.getByText('Encoding'));
    
    // Change CRF
    const crfInput = screen.getByDisplayValue(23);
    fireEvent.change(crfInput, { target: { value: '18' } });
    
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        ffmpeg: expect.objectContaining({ crf: 18 })
    }));
  });
});
