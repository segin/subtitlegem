import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineToolbar } from './TimelineToolbar';
import '@testing-library/jest-dom';

describe('TimelineToolbar', () => {
  const defaultProps = {
    onSplitMode: jest.fn(),
    isSplitMode: false,
    onDeleteSelected: jest.fn(),
    onDuplicateSelected: jest.fn(),
    hasSelection: false,
  };

  test('renders all buttons', () => {
    render(<TimelineToolbar {...defaultProps} />);

    expect(screen.getByTitle(/Split Clip/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Duplicate Selected Clip/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Delete Selected Clip/i)).toBeInTheDocument();
  });

  test('calls onSplitMode when split button is clicked', () => {
    const onSplitMode = jest.fn();
    render(<TimelineToolbar {...defaultProps} onSplitMode={onSplitMode} />);

    fireEvent.click(screen.getByTitle(/Split Clip/i));
    expect(onSplitMode).toHaveBeenCalledTimes(1);
  });

  test('shows helper message and active style when isSplitMode is true', () => {
    render(<TimelineToolbar {...defaultProps} isSplitMode={true} />);

    expect(screen.getByText(/Click on a clip to split/i)).toBeInTheDocument();

    const splitButton = screen.getByTitle(/Split Clip/i);
    expect(splitButton).toHaveClass('bg-[#007acc]');
    expect(splitButton).toHaveClass('text-white');
  });

  test('duplicate and delete buttons are disabled when hasSelection is false', () => {
    render(<TimelineToolbar {...defaultProps} hasSelection={false} />);

    expect(screen.getByTitle(/Duplicate Selected Clip/i)).toBeDisabled();
    expect(screen.getByTitle(/Delete Selected Clip/i)).toBeDisabled();
  });

  test('duplicate and delete buttons are enabled when hasSelection is true and handlers are provided', () => {
    render(<TimelineToolbar {...defaultProps} hasSelection={true} />);

    const duplicateButton = screen.getByTitle(/Duplicate Selected Clip/i);
    const deleteButton = screen.getByTitle(/Delete Selected Clip/i);

    expect(duplicateButton).not.toBeDisabled();
    expect(deleteButton).not.toBeDisabled();

    fireEvent.click(duplicateButton);
    expect(defaultProps.onDuplicateSelected).toHaveBeenCalled();

    fireEvent.click(deleteButton);
    expect(defaultProps.onDeleteSelected).toHaveBeenCalled();
  });

  test('buttons are disabled if handlers are missing even if hasSelection is true', () => {
    render(
      <TimelineToolbar
        onSplitMode={jest.fn()}
        isSplitMode={false}
        hasSelection={true}
      />
    );

    expect(screen.getByTitle(/Duplicate Selected Clip/i)).toBeDisabled();
    expect(screen.getByTitle(/Delete Selected Clip/i)).toBeDisabled();
  });

  test('applies custom className', () => {
    const { container } = render(<TimelineToolbar {...defaultProps} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
