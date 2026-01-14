
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VideoUpload } from './VideoUpload';
import '@testing-library/jest-dom';

// Mocks
jest.mock('@/lib/upload-utils', () => ({
  validateVideoFile: jest.fn(() => ({ valid: true })),
  prepareUploadFormData: jest.fn(() => new FormData()),
  generateClipId: jest.fn(() => 'mock-id')
}));

jest.mock('@/lib/model-cache', () => ({
  cacheModelResult: jest.fn(),
  checkModelAvailability: jest.fn(() => Promise.resolve(true))
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock XMLHttpRequest
const mockXHR = {
    open: jest.fn(),
    send: jest.fn(),
    upload: {
        addEventListener: jest.fn()
    },
    addEventListener: jest.fn(),
    status: 200,
    responseText: JSON.stringify({ 
        subtitles: [], 
        videoPath: '/tmp/vid.mp4',
        detectedLanguage: 'en'
    })
};

// @ts-ignore
window.XMLHttpRequest = jest.fn(() => mockXHR);

describe('VideoUpload', () => {
    const onUploadComplete = jest.fn();
    const onUploadModeChange = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ models: [{ name: 'gemini-pro', displayName: 'Gemini Pro' }] })
        });
    });

    test('renders upload modes correctly', () => {
        render(<VideoUpload onUploadComplete={onUploadComplete} onUploadModeChange={onUploadModeChange} uploadMode="single" />);
        
        expect(screen.getByText('Single')).toBeInTheDocument();
        expect(screen.getByText('Multi-Video')).toBeInTheDocument();
        expect(screen.getByText('Batch')).toBeInTheDocument();
        expect(screen.getByText('Advanced')).toBeInTheDocument();
    });

    test('calls onUploadModeChange when clicking modes', () => {
        render(<VideoUpload onUploadComplete={onUploadComplete} onUploadModeChange={onUploadModeChange} uploadMode="single" />);
        
        fireEvent.click(screen.getByText('Batch').closest('button')!);
        expect(onUploadModeChange).toHaveBeenCalledWith('batch');
    });

    test('renders model selector and secondary language', () => {
        render(<VideoUpload onUploadComplete={onUploadComplete} />);
        
        expect(screen.getByText('AI Model')).toBeInTheDocument();
        expect(screen.getByText('Secondary Language')).toBeInTheDocument();
    });
});
