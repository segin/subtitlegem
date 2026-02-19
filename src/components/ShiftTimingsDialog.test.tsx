import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShiftTimingsDialog } from './ShiftTimingsDialog';
import '@testing-library/jest-dom';

describe('ShiftTimingsDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onShift: jest.fn(),
    subtitleCount: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders nothing when closed', () => {
    const { container } = render(<ShiftTimingsDialog {...defaultProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders dialog content when open', () => {
    render(<ShiftTimingsDialog {...defaultProps} />);
    expect(screen.getByText('Shift All Timings')).toBeInTheDocument();
    expect(screen.getByText(/Shift all 10 subtitle\(s\)/)).toBeInTheDocument();
  });

  test('can switch direction', () => {
    render(<ShiftTimingsDialog {...defaultProps} />);

    const forwardBtn = screen.getByText(/Forward \(Later\)/);
    const backwardBtn = screen.getByText(/Backward \(Earlier\)/);

    // Default is forward
    expect(forwardBtn).toHaveClass('bg-[#007acc]');

    fireEvent.click(backwardBtn);
    expect(backwardBtn).toHaveClass('bg-[#007acc]');
    expect(forwardBtn).not.toHaveClass('bg-[#007acc]');

    fireEvent.click(forwardBtn);
    expect(forwardBtn).toHaveClass('bg-[#007acc]');
  });

  test('updates preview message based on input and direction', () => {
    render(<ShiftTimingsDialog {...defaultProps} />);

    const input = screen.getByLabelText(/Offset \(seconds\)/);
    fireEvent.change(input, { target: { value: '1.5' } });

    expect(screen.getByText('All subtitles will be shifted 1.5s later.')).toBeInTheDocument();

    const backwardBtn = screen.getByText(/Backward \(Earlier\)/);
    fireEvent.click(backwardBtn);

    expect(screen.getByText('All subtitles will be shifted 1.5s earlier.')).toBeInTheDocument();
  });

  test('calls onShift with positive ms for forward shift', () => {
    render(<ShiftTimingsDialog {...defaultProps} />);

    const input = screen.getByLabelText(/Offset \(seconds\)/);
    fireEvent.change(input, { target: { value: '2' } });

    const applyBtn = screen.getByText('Apply Shift');
    fireEvent.click(applyBtn);

    expect(defaultProps.onShift).toHaveBeenCalledWith(2000);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  test('calls onShift with negative ms for backward shift', () => {
    render(<ShiftTimingsDialog {...defaultProps} />);

    const input = screen.getByLabelText(/Offset \(seconds\)/);
    fireEvent.change(input, { target: { value: '1.5' } });

    const backwardBtn = screen.getByText(/Backward \(Earlier\)/);
    fireEvent.click(backwardBtn);

    const applyBtn = screen.getByText('Apply Shift');
    fireEvent.click(applyBtn);

    expect(defaultProps.onShift).toHaveBeenCalledWith(-1500);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  test('calls onClose when clicking Cancel', () => {
    render(<ShiftTimingsDialog {...defaultProps} />);
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  test('calls onClose when clicking X button', () => {
    render(<ShiftTimingsDialog {...defaultProps} />);
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  test('calls onClose when pressing Escape key', () => {
    render(<ShiftTimingsDialog {...defaultProps} />);
    fireEvent.keydown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  test('calls onClose when clicking outside the dialog', () => {
    render(<ShiftTimingsDialog {...defaultProps} />);
    // The overlay is the first div in the component
    const overlay = screen.getByRole('dialog').parentElement;
    if (overlay) {
      fireEvent.mousedown(overlay);
      expect(defaultProps.onClose).toHaveBeenCalled();
    }
  });

  test('does not call onClose when clicking inside the dialog', () => {
    render(<ShiftTimingsDialog {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    fireEvent.mousedown(dialog);
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  test('disables Apply Shift button for negative offset', () => {
    render(<ShiftTimingsDialog {...defaultProps} />);
    const input = screen.getByLabelText(/Offset \(seconds\)/);
    fireEvent.change(input, { target: { value: '-1' } });
    const applyBtn = screen.getByRole('button', { name: 'Apply Shift' });
    expect(applyBtn).toBeDisabled();
  });

  test('handles zero offset by just closing', () => {
    render(<ShiftTimingsDialog {...defaultProps} />);
    const input = screen.getByLabelText(/Offset \(seconds\)/);
    fireEvent.change(input, { target: { value: '0' } });
    const applyBtn = screen.getByText('Apply Shift');
    fireEvent.click(applyBtn);
    expect(defaultProps.onShift).not.toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
