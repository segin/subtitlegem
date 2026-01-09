import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AboutDialog } from './AboutDialog';
import '@testing-library/jest-dom';

describe('AboutDialog', () => {
  test('renders nothing when closed', () => {
    const { container } = render(<AboutDialog isOpen={false} onClose={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders content when open', () => {
    render(<AboutDialog isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByText('About SubtitleGem')).toBeVisible();
    expect(screen.getByText('v0.1.0-alpha')).toBeVisible();
  });

  test('calls onClose when clicking close button', () => {
    const onClose = jest.fn();
    render(<AboutDialog isOpen={true} onClose={onClose} />);
    
    // Icon button usually has no text, might need aria-label or find by generic role
    // Implementation: <button onClick={onClose} ...><X /></button>
    // X icon usually accessible via SVG or we can find closest button to header.
    // Or just click overlay?
    
    const closeButtons = screen.getAllByRole('button');
    // Assuming the specific close button is one of them.
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  test('calls onClose when clicking overlay', () => {
    const onClose = jest.fn();
    const { container } = render(<AboutDialog isOpen={true} onClose={onClose} />);
    
    // The outer div has the click handler
    fireEvent.click(container.firstChild as Element);
    expect(onClose).toHaveBeenCalled();
  });

  test('does not close when clicking content', () => {
    const onClose = jest.fn();
    render(<AboutDialog isOpen={true} onClose={onClose} />);
    
    fireEvent.click(screen.getByText('SubtitleGem'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
