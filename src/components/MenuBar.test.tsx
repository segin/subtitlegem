import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MenuBar } from './MenuBar';
import '@testing-library/jest-dom';

// Mock UI components if necessary, but Menu/MenuItem are likely simple enough.
// If Menu uses portals or complex logic, we might need a test wrapper.
// Assuming basic React standard rendering.

describe('MenuBar', () => {
  const defaultProps = {
    onNewProject: jest.fn(),
    onOpenProject: jest.fn(),
    onSaveProject: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    recentDrafts: [],
  };

  test('renders menu triggers', () => {
    render(<MenuBar {...defaultProps} />);
    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  test('opens File menu and clicks New Project', () => {
    render(<MenuBar {...defaultProps} />);
    
    // Open File menu
    fireEvent.click(screen.getByText('File'));
    
    // Check item visibility
    const newItem = screen.getByText('New Project');
    expect(newItem).toBeVisible();

    // Click item
    fireEvent.click(newItem);
    expect(defaultProps.onNewProject).toHaveBeenCalled();
  });

  test('handles Undo/Redo disabled state', () => {
    render(<MenuBar {...defaultProps} canUndo={false} canRedo={true} />);
    
    fireEvent.click(screen.getByText('Edit'));
    
    const undoItem = screen.getByText('Undo').closest('button');
    const redoItem = screen.getByText('Redo').closest('button');

    expect(undoItem).toBeDisabled();
    expect(redoItem).not.toBeDisabled();
  });

  test('shows recent drafts in submenu', () => { // Note: Submenu implementation depends on UI Library
    // If Submenu is just nested Items in DOM:
    const props = {
      ...defaultProps,
      recentDrafts: [{ id: '1', name: 'Draft 1', date: '2023-01-01' }],
      onLoadDraft: jest.fn()
    };
    
    render(<MenuBar {...props} />);

    // Open File menu
    fireEvent.click(screen.getByText('File'));
    
    // Hover over Open Draft to trigger submenu
    const openDraftItem = screen.getByText('Open Draft');
    fireEvent.mouseEnter(openDraftItem.closest('button')!);
    
    // Check if 'Draft 1' is rendered 
    expect(screen.getByText('Draft 1')).toBeVisible();
  });

  test('ensure single highlight when moving between sibling items with submenu', () => {
     jest.useFakeTimers();
     const props = {
       ...defaultProps,
       recentDrafts: [{ id: '1', name: 'Draft 1', date: '2023-01-01' }],
       onLoadDraft: jest.fn()
     };
     render(<MenuBar {...props} />);

     // Open File menu
     fireEvent.click(screen.getByText('File'));

     // Hover "Open Draft" (Submenu item)
     const openDraftText = screen.getByText('Open Draft');
     const openDraftBtn = openDraftText.closest('button');
     fireEvent.mouseEnter(openDraftBtn!);
     
     // Should be active blue
     expect(openDraftBtn).toHaveClass('bg-[#094771]');

     // Hover "New Project" (Sibling)
     const newProjectText = screen.getByText('New Project');
     const newProjectBtn = newProjectText.closest('button');
     
     // Simulate user moving mouse
     fireEvent.mouseLeave(openDraftBtn!); // Triggers timeout in SubMenuItem
     fireEvent.mouseEnter(newProjectBtn!); // Updates focus in Menu

     // Before timeout executes (submenu lingering open), Open Draft should lose highlight
     // because we removed isOpen from the class condition
     expect(openDraftBtn).not.toHaveClass('bg-[#094771]'); 
     expect(newProjectBtn).toHaveClass('bg-[#094771]');
     
     jest.useRealTimers();
  });
});
