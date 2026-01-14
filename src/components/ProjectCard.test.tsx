import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectCard } from './ProjectCard';
import { DraftItem } from '@/hooks/useHomeState';
import '@testing-library/jest-dom';

const mockDraft: DraftItem = {
    id: '1',
    name: 'Test Project',
    createdAt: new Date('2023-01-01').toISOString(), 
    updatedAt: new Date('2023-01-01').toISOString(),
    videoPath: '/path/to/video.mp4',
    metrics: {
        sourceSize: 1024 * 1024, // 1MB
        renderedSize: 0,
        sourceCount: 1,
        subtitleCount: 50,
        renderCount: 2,
        lifetimeRenderCount: 5
    },
    cache_summary: 'Test summary'
};

describe('ProjectCard', () => {
    const onClick = jest.fn();
    const onDelete = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders draft information', () => {
        render(<ProjectCard draft={mockDraft} isSelected={false} onClick={onClick} onDelete={onDelete} />);
        
        expect(screen.getByText('Test Project')).toBeInTheDocument();
        // Date formatting might vary by locale, check partial or just existence.
        // Jan 1
        const dateStr = new Date('2023-01-01').toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
        });
        expect(screen.getAllByText(dateStr)[0]).toBeInTheDocument();
        
        // Metrics
        expect(screen.getByTitle(/Total: 1 MB/)).toBeInTheDocument(); // FormatUtils dependent
        expect(screen.getByText('50')).toBeInTheDocument(); // Subtitles
        expect(screen.getByText('2')).toBeInTheDocument(); // Renders
    });

    test('handles click', () => {
        render(<ProjectCard draft={mockDraft} isSelected={false} onClick={onClick} onDelete={onDelete} />);
        fireEvent.click(screen.getByText('Test Project'));
        expect(onClick).toHaveBeenCalled();
    });

    test('handles delete', () => {
        render(<ProjectCard draft={mockDraft} isSelected={false} onClick={onClick} onDelete={onDelete} />);
        
        // Delete button is usually an icon button. Use title or role.
        const deleteBtn = screen.getByTitle('Delete Draft');
        fireEvent.click(deleteBtn);
        expect(onDelete).toHaveBeenCalled();
    });

    test('shows selected state', () => {
        const { container } = render(<ProjectCard draft={mockDraft} isSelected={true} onClick={onClick} onDelete={onDelete} />);
        // Check for border class or style
        expect(container.firstChild).toHaveClass('border-l-blue-500');
    });

    test('handles rename interaction', () => {
        const onRename = jest.fn();
        render(<ProjectCard draft={mockDraft} isSelected={false} onClick={onClick} onDelete={onDelete} onRename={onRename} />);
        
        // Pencil icon button should be present
        const renameBtn = screen.getByTitle('Rename Project');
        expect(renameBtn).toBeInTheDocument();
        
        fireEvent.click(renameBtn);
        expect(onRename).toHaveBeenCalled();
    });

    test('default state is collapsed', () => {
        render(<ProjectCard draft={mockDraft} isSelected={false} onClick={onClick} onDelete={onDelete} />);
        const summary = screen.getByText('Test summary').closest('div')?.parentElement;
        expect(summary).toHaveClass('max-h-0');
        expect(summary).not.toHaveClass('max-h-40');
    });

    test('forceExpanded state is expanded', () => {
        render(<ProjectCard draft={mockDraft} isSelected={false} onClick={onClick} onDelete={onDelete} forceExpanded={true} />);
        const summary = screen.getByText('Test summary').closest('div')?.parentElement;
        expect(summary).toHaveClass('max-h-40');
        expect(summary).toHaveClass('opacity-100');
    });
});
