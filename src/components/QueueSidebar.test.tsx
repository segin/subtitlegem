import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueueSidebar } from './QueueSidebar';
import { QueueItem } from '@/types/queue';

// Mock dependencies
const mockOnEdit = jest.fn();
const mockOnRemove = jest.fn();

const mockItems: QueueItem[] = [
  {
    id: '1',
    file: { name: 'test.mp4', size: 1024 },
    status: 'pending',
    progress: 0,
    model: 'gemini',
    createdAt: Date.now(),
  },
  {
    id: '2',
    file: { name: 'completed.mp4', size: 2048 },
    status: 'completed',
    progress: 100,
    model: 'gemini',
    createdAt: Date.now(),
    result: {
        videoPath: '/path/to/video.mp4'
    }
  },
];

describe('QueueSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    window.confirm = jest.fn();
    window.alert = jest.fn();
    window.open = jest.fn();
  });

  it('renders queue items correctly', () => {
    render(<QueueSidebar items={mockItems} onEdit={mockOnEdit} onRemove={mockOnRemove} />);

    expect(screen.getByText('test.mp4')).toBeInTheDocument();
    expect(screen.getByText('completed.mp4')).toBeInTheDocument();
    expect(screen.getByText('Queue (2)')).toBeInTheDocument();
  });

  it('handleCloseout deletes job data and removes item on success', async () => {
    // Mock confirm to return true
    (window.confirm as jest.Mock).mockReturnValue(true);
    // Mock fetch to return success
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('Deleted'),
    });

    render(<QueueSidebar items={mockItems} onEdit={mockOnEdit} onRemove={mockOnRemove} />);

    // Find the delete button for the completed item
    // It's the Trash2 icon in the completed section.
    // We can find it by aria-label if I added one, or title.
    // I added title="Delete all job data"
    const deleteBtn = screen.getByTitle('Delete all job data');
    fireEvent.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Delete all job data'));

    await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/queue?id=2'),
            expect.objectContaining({ method: 'DELETE' })
        );
    });

    expect(mockOnRemove).toHaveBeenCalledWith('2');
  });

  it('handleCloseout does not delete if not confirmed', async () => {
    (window.confirm as jest.Mock).mockReturnValue(false);

    render(<QueueSidebar items={mockItems} onEdit={mockOnEdit} onRemove={mockOnRemove} />);

    const deleteBtn = screen.getByTitle('Delete all job data');
    fireEvent.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockOnRemove).not.toHaveBeenCalled();
  });

  it('handleCloseout handles API error', async () => {
    (window.confirm as jest.Mock).mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      text: jest.fn().mockResolvedValue('Server Error'),
    });

    render(<QueueSidebar items={mockItems} onEdit={mockOnEdit} onRemove={mockOnRemove} />);

    const deleteBtn = screen.getByTitle('Delete all job data');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
    });

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Failed to delete job'));
    expect(mockOnRemove).not.toHaveBeenCalled();
  });
});
