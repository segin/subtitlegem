import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import * as fc from 'fast-check';
import '@testing-library/jest-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog';

// ============================================================================
// Unit Tests
// ============================================================================

describe('Dialog', () => {
  describe('Unit Tests', () => {
    test('renders children when open=true', () => {
      render(
        <Dialog open={true} onOpenChange={() => {}}>
          <div data-testid="child">Hello</div>
        </Dialog>
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    test('does not render children when open=false', () => {
      render(
        <Dialog open={false} onOpenChange={() => {}}>
          <div data-testid="child">Hello</div>
        </Dialog>
      );
      expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    });

    test('calls onOpenChange(false) when backdrop clicked', () => {
      const onOpenChange = jest.fn();
      render(
        <Dialog open={true} onOpenChange={onOpenChange}>
          <DialogContent>Content</DialogContent>
        </Dialog>
      );
      
      // Click the backdrop (the absolute positioned overlay)
      const backdrop = document.querySelector('.fixed.inset-0 > .absolute.inset-0');
      fireEvent.click(backdrop!);
      
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    test('does not close when content is clicked', () => {
      const onOpenChange = jest.fn();
      render(
        <Dialog open={true} onOpenChange={onOpenChange}>
          <DialogContent>Content</DialogContent>
        </Dialog>
      );
      
      // Click on DialogContent (the text 'Content')
      fireEvent.click(screen.getByText('Content'));
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
});

describe('DialogContent', () => {
  test('renders children', () => {
    render(<DialogContent>Test Content</DialogContent>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    render(<DialogContent className="custom-class">Content</DialogContent>);
    const content = screen.getByText('Content').closest('div');
    expect(content).toHaveClass('custom-class');
  });

  test('has default styling classes', () => {
    render(<DialogContent>Content</DialogContent>);
    const content = screen.getByText('Content').closest('div');
    expect(content).toHaveClass('relative', 'z-50', 'w-full', 'p-6');
  });
});

describe('DialogHeader', () => {
  test('renders children', () => {
    render(<DialogHeader>Header Text</DialogHeader>);
    expect(screen.getByText('Header Text')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    render(<DialogHeader className="custom-header">Header</DialogHeader>);
    const header = screen.getByText('Header').closest('div');
    expect(header).toHaveClass('custom-header');
  });
});

describe('DialogTitle', () => {
  test('renders as h2 element', () => {
    render(<DialogTitle>Title Text</DialogTitle>);
    const title = screen.getByText('Title Text');
    expect(title.tagName).toBe('H2');
  });

  test('applies custom className', () => {
    render(<DialogTitle className="custom-title">Title</DialogTitle>);
    const title = screen.getByText('Title');
    expect(title).toHaveClass('custom-title');
  });
});

describe('DialogFooter', () => {
  test('renders children', () => {
    render(
      <DialogFooter>
        <button>Cancel</button>
        <button>Confirm</button>
      </DialogFooter>
    );
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    render(<DialogFooter className="custom-footer">Footer</DialogFooter>);
    const footer = screen.getByText('Footer').closest('div');
    expect(footer).toHaveClass('custom-footer');
  });
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Property Tests', () => {
  test('DialogContent handles arbitrary className strings', () => {
    fc.assert(
      fc.property(fc.string(), (className) => {
        // Filter out strings that would break React (e.g., very long strings)
        if (className.length > 1000) return true;
        
        const { unmount } = render(
          <DialogContent className={className}>Content</DialogContent>
        );
        
        const content = screen.getByText('Content');
        expect(content).toBeInTheDocument();
        unmount();
      }),
      { numRuns: 50 }
    );
  });

  test('Dialog always renders children when open=true regardless of content', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{2,20}$/), (text: string) => {
        const { unmount } = render(
          <Dialog open={true} onOpenChange={() => {}}>
            <div data-testid="content">{text}</div>
          </Dialog>
        );
        
        expect(screen.getByTestId('content')).toHaveTextContent(text);
        unmount();
      }),
      { numRuns: 50 }
    );
  });

  test('DialogTitle preserves text content exactly', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{2,20}$/), (text: string) => {
        const { unmount } = render(<DialogTitle>{text}</DialogTitle>);
        expect(screen.getByRole('heading', { name: text })).toBeInTheDocument();
        unmount();
      }),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Fuzzer Tests
// ============================================================================

describe('Fuzzer Tests', () => {
  test('Dialog handles empty children gracefully', () => {
    expect(() => {
      render(
        <Dialog open={true} onOpenChange={() => {}}>
          {null}
        </Dialog>
      );
    }).not.toThrow();
  });

  test('Dialog handles undefined children', () => {
    expect(() => {
      render(
        <Dialog open={true} onOpenChange={() => {}}>
          {undefined}
        </Dialog>
      );
    }).not.toThrow();
  });

  test('DialogContent handles unicode classNames', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 50 }), (className: string) => {
        const { unmount } = render(
          <DialogContent className={className}>Test</DialogContent>
        );
        expect(screen.getByText('Test')).toBeInTheDocument();
        unmount();
      }),
      { numRuns: 30 }
    );
  });

  test('DialogTitle handles special characters', () => {
    const specialStrings = [
      '<script>alert("xss")</script>',
      '&lt;div&gt;',
      'Hello\nWorld',
      'Tab\there',
      '🎉🔥💯',
      '中文标题',
      'العربية',
      '',
    ];
    
    specialStrings.forEach((str) => {
      const { unmount } = render(<DialogTitle>{str}</DialogTitle>);
      // Should render without throwing
      unmount();
    });
  });

  test('Dialog rapid open/close cycles', () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(
      <Dialog open={false} onOpenChange={onOpenChange}>
        <div>Content</div>
      </Dialog>
    );

    // Rapidly toggle open state
    for (let i = 0; i < 100; i++) {
      rerender(
        <Dialog open={i % 2 === 0} onOpenChange={onOpenChange}>
          <div>Content</div>
        </Dialog>
      );
    }
    
    // Should not throw and final state should be closed (i=99, 99%2=1, so open=false)
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  test('Nested DialogContent renders correctly', () => {
    render(
      <Dialog open={true} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Outer Title</DialogTitle>
          </DialogHeader>
          <DialogContent className="nested">
            <DialogTitle>Nested Title</DialogTitle>
          </DialogContent>
          <DialogFooter>
            <button>OK</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );

    expect(screen.getByText('Outer Title')).toBeInTheDocument();
    expect(screen.getByText('Nested Title')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
  });
});
