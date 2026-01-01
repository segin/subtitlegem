import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GlobalSettingsDialog } from './GlobalSettingsDialog';
import { DEFAULT_GLOBAL_SETTINGS } from '@/types/subtitle';
import '@testing-library/jest-dom';

// Mock TrackStyleEditor to simplify tests
jest.mock('./TrackStyleEditor', () => ({
  TrackStyleEditor: ({ style, onChange, mode }: any) => (
    <div data-testid="track-style-editor">
      Mock Editor Mode: {mode}
      <button onClick={() => onChange({ fontSize: 7 })} data-testid="update-style-btn">
        Update Style
      </button>
    </div>
  ),
}));

// Mock fetch
global.fetch = jest.fn();

describe('GlobalSettingsDialog', () => {
    const mockOnClose = jest.fn();
    
    beforeEach(() => {
        jest.clearAllMocks();
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => DEFAULT_GLOBAL_SETTINGS,
        });
    });

    it('should not render when isOpen is false', () => {
        const { container } = render(
            <GlobalSettingsDialog isOpen={false} onClose={mockOnClose} />
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('should load settings on mount', async () => {
        render(<GlobalSettingsDialog isOpen={true} onClose={mockOnClose} />);
        
        expect(global.fetch).toHaveBeenCalledWith('/api/settings');
        await waitFor(() => {
            expect(screen.getByText('Global Settings')).toBeInTheDocument();
        });
    });

    it('should toggle aspect ratio (16:9 / 9:16)', async () => {
        render(<GlobalSettingsDialog isOpen={true} onClose={mockOnClose} />);
        
        // Wait for loading to finish and preview to appear
        await waitFor(() => expect(screen.getByText(/Sample Text Line 1/)).toBeInTheDocument());

        // Default should be 16:9
        const btn169 = screen.getByText('16:9');
        const btn916 = screen.getByText('9:16');
        
        const sampleText = screen.getByText(/Sample Text Line 1/);
        const previewContainer = sampleText.closest('div')?.parentElement; // The container holding the text box
        
        if (!previewContainer) throw new Error('Preview container not found');

        // Check height for 16:9
        expect(previewContainer).toHaveStyle({ height: '180px' });
        
        // Click 9:16
        fireEvent.click(btn916);
        
        // Check height for 9:16 (320 * 16/9 = 568.888...)
        expect(previewContainer).toHaveStyle({ height: '568.8888888888889px' });
    });

    it('should pass percentage mode to style editor', async () => {
         render(<GlobalSettingsDialog isOpen={true} onClose={mockOnClose} />);
         await waitFor(() => {
             expect(screen.getByTestId('track-style-editor')).toBeInTheDocument();
         });
         
         expect(screen.getByText('Mock Editor Mode: percentage')).toBeInTheDocument();
    });
});
