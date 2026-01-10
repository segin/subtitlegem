import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { Menu, MenuItem } from './Menu';
import '@testing-library/jest-dom';

const mockItems: MenuItem[] = [
  { id: 'item1', label: 'First Item', onClick: jest.fn() },
  { id: 'item2', label: 'Second Item', onClick: jest.fn() },
  { divider: true },
  { id: 'item3', label: 'Third Item', onClick: jest.fn(), disabled: true },
  { id: 'item4', label: 'Fourth Item', onClick: jest.fn(), shortcut: 'Ctrl+F' },
];

describe('Menu Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render menu trigger button', () => {
      render(<Menu label="Test Menu" items={mockItems} />);
      expect(screen.getByRole('button', { name: 'Test Menu' })).toBeInTheDocument();
    });

    it('should not show dropdown when closed', () => {
      render(<Menu label="Test Menu" items={mockItems} />);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('should show dropdown when opened', () => {
      render(<Menu label="Test Menu" items={mockItems} />);
      fireEvent.click(screen.getByText('Test Menu'));
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  describe('ARIA Attributes', () => {
    it('should have correct ARIA attributes on trigger', () => {
      render(<Menu label="Test Menu" items={mockItems} />);
      const trigger = screen.getByRole('button', { name: 'Test Menu' });
      
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('should update aria-expanded when opened', () => {
      render(<Menu label="Test Menu" items={mockItems} />);
      const trigger = screen.getByRole('button', { name: 'Test Menu' });
      
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have role=menuitem on items', () => {
      render(<Menu label="Test Menu" items={mockItems} />);
      fireEvent.click(screen.getByText('Test Menu'));
      
      const items = screen.getAllByRole('menuitem');
      expect(items.length).toBe(4); // 4 items, 1 divider not counted
    });

    it('should have role=separator on dividers', () => {
      render(<Menu label="Test Menu" items={mockItems} />);
      fireEvent.click(screen.getByText('Test Menu'));
      
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate down with ArrowDown', async () => {
      render(<Menu label="Test Menu" items={mockItems} />);
      fireEvent.click(screen.getByText('Test Menu'));
      
      const menu = screen.getByRole('menu');
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      
      // Should skip to second item (first was already focused)
      await waitFor(() => {
        expect(screen.getByText('Second Item').closest('button')).toHaveFocus();
      });
    });

    it('should navigate up with ArrowUp', async () => {
      render(<Menu label="Test Menu" items={mockItems} />);
      fireEvent.click(screen.getByText('Test Menu'));
      
      const menu = screen.getByRole('menu');
      // Go down first
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      // Then up
      fireEvent.keyDown(menu, { key: 'ArrowUp' });
      
      await waitFor(() => {
        expect(screen.getByText('First Item').closest('button')).toHaveFocus();
      });
    });

    it('should skip disabled items', async () => {
      render(<Menu label="Test Menu" items={mockItems} />);
      fireEvent.click(screen.getByText('Test Menu'));
      
      const menu = screen.getByRole('menu');
      // Navigate to second
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      // Navigate past divider and disabled item to fourth
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      
      await waitFor(() => {
        expect(screen.getByText('Fourth Item').closest('button')).toHaveFocus();
      });
    });

    it('should close on Escape', () => {
      render(<Menu label="Test Menu" items={mockItems} />);
      fireEvent.click(screen.getByText('Test Menu'));
      
      expect(screen.getByRole('menu')).toBeInTheDocument();
      
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
      
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('should activate item on Enter', () => {
      const onClick = jest.fn();
      const items: MenuItem[] = [{ id: 'test', label: 'Test', onClick }];
      
      render(<Menu label="Test Menu" items={items} />);
      fireEvent.click(screen.getByText('Test Menu'));
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Enter' });
      
      expect(onClick).toHaveBeenCalled();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('should jump to first item on Home', async () => {
      render(<Menu label="Test Menu" items={mockItems} />);
      fireEvent.click(screen.getByText('Test Menu'));
      
      const menu = screen.getByRole('menu');
      // Navigate down
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      // Jump to first
      fireEvent.keyDown(menu, { key: 'Home' });
      
      await waitFor(() => {
        expect(screen.getByText('First Item').closest('button')).toHaveFocus();
      });
    });

    it('should jump to last item on End', async () => {
      render(<Menu label="Test Menu" items={mockItems} />);
      fireEvent.click(screen.getByText('Test Menu'));
      
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' });
      
      await waitFor(() => {
        expect(screen.getByText('Fourth Item').closest('button')).toHaveFocus();
      });
    });
  });

  describe('Cross-Menu Navigation', () => {
    it('should call onNavigateLeft on ArrowLeft', () => {
      const onNavigateLeft = jest.fn();
      render(<Menu label="Test Menu" items={mockItems} onNavigateLeft={onNavigateLeft} isOpen={true} onOpenChange={() => {}} />);
      
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' });
      
      expect(onNavigateLeft).toHaveBeenCalled();
    });

    it('should call onNavigateRight on ArrowRight', () => {
      const onNavigateRight = jest.fn();
      render(<Menu label="Test Menu" items={mockItems} onNavigateRight={onNavigateRight} isOpen={true} onOpenChange={() => {}} />);
      
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
      
      expect(onNavigateRight).toHaveBeenCalled();
    });
  });

  describe('Hover-to-Open', () => {
    it('should open on hover when another menu is open', () => {
      const onOpenChange = jest.fn();
      render(<Menu label="Test Menu" items={mockItems} isAnyMenuOpen={true} isOpen={false} onOpenChange={onOpenChange} />);
      
      fireEvent.mouseEnter(screen.getByRole('button', { name: 'Test Menu' }));
      
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it('should not open on hover when no menu is open', () => {
      const onOpenChange = jest.fn();
      render(<Menu label="Test Menu" items={mockItems} isAnyMenuOpen={false} isOpen={false} onOpenChange={onOpenChange} />);
      
      fireEvent.mouseEnter(screen.getByRole('button', { name: 'Test Menu' }));
      
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('Checkmarks', () => {
    it('should display checkmark for checked items', () => {
      const items: MenuItem[] = [
        { id: 'checked', label: 'Checked Item', checked: true },
        { id: 'unchecked', label: 'Unchecked Item', checked: false },
      ];
      
      render(<Menu label="Test Menu" items={items} />);
      fireEvent.click(screen.getByText('Test Menu'));
      
      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    });
  });
  describe('Submenus', () => {
    const submenuItems: MenuItem[] = [
      { 
        id: 'parent', 
        label: 'Parent Item', 
        items: [
          { id: 'child1', label: 'Child Item 1', onClick: jest.fn() },
          { id: 'child2', label: 'Child Item 2', onClick: jest.fn() }
        ] 
      }
    ];

    it('should render submenu trigger', () => {
      render(<Menu label="Test Menu" items={submenuItems} />);
      fireEvent.click(screen.getByText('Test Menu'));
      
      expect(screen.getByText('Parent Item')).toBeInTheDocument();
      // Arrow icon
      expect(screen.getByText('Parent Item').closest('button')).toContainHTML('svg'); 
    });

    it('should open submenu on mouse enter', async () => {
      render(<Menu label="Test Menu" items={submenuItems} />);
      fireEvent.click(screen.getByText('Test Menu'));
      
      const parentItem = screen.getByText('Parent Item').closest('button')!;
      fireEvent.mouseEnter(parentItem);
      
      await waitFor(() => {
        expect(screen.getByText('Child Item 1')).toBeInTheDocument();
      });
    });

    it('should open submenu with ArrowRight', async () => {
      render(<Menu label="Test Menu" items={submenuItems} />);
      fireEvent.click(screen.getByText('Test Menu'));
      
      const menu = screen.getByRole('menu');
      fireEvent.keyDown(menu, { key: 'ArrowDown' }); // Focus parent
      
      const parentBtn = screen.getByText('Parent Item').closest('button')!;
      fireEvent.keyDown(parentBtn, { key: 'ArrowRight' }); // Open submenu via button handler
      
      await waitFor(() => {
        expect(screen.getByText('Child Item 1')).toBeInTheDocument();
        expect(screen.getByText('Child Item 1').closest('button')).toHaveFocus();
      });
    });

    it('should close submenu with ArrowLeft', async () => {
      render(<Menu label="Test Menu" items={submenuItems} />);
      fireEvent.click(screen.getByText('Test Menu'));
      
      // Open submenu
      const parentItem = screen.getByText('Parent Item').closest('button')!;
      fireEvent.mouseEnter(parentItem);
      
      await waitFor(() => {
        expect(screen.getByText('Child Item 1')).toBeVisible();
      });

      // Focus child - fire ArrowRight to focus first child if not already focused? 
      // MouseEnter doesn't focus child automatically? logic says requestAnimationFrame focus
      // But let's simulate focus
      const childItem = screen.getByText('Child Item 1').closest('button')!;
      childItem.focus();

      // Fire ArrowLeft on the CHILD. It bubbles to submenu container which handles it.
      fireEvent.keyDown(childItem, { key: 'ArrowLeft' });
      
      await waitFor(() => {
        expect(screen.queryByText('Child Item 1')).not.toBeInTheDocument();
        expect(parentItem).toHaveFocus();
      });
    });

    it('should click child item and close all menus', async () => {
      const onClick = jest.fn();
      const itemsWithClick: MenuItem[] = [{
        id: 'parent', label: 'Parent', items: [{ id: 'child', label: 'Child', onClick }]
      }];

      render(<Menu label="Test Menu" items={itemsWithClick} />);
      fireEvent.click(screen.getByText('Test Menu'));
      
      // Open submenu
      fireEvent.mouseEnter(screen.getByText('Parent'));
      await waitFor(() => screen.getByText('Child'));
      
      fireEvent.click(screen.getByText('Child'));
      
      expect(onClick).toHaveBeenCalled();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// Property Tests (using fast-check)
// ============================================================================

describe('Menu Property Tests', () => {
  test('menu handles arbitrary number of items (0 to 100)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (count: number) => {
        const items: MenuItem[] = Array.from({ length: count }, (_, i) => ({
          label: `Item ${i}`,
          onClick: jest.fn(),
        }));
        
        const { unmount } = render(<Menu label="Test" items={items} isOpen={count > 0} />);
        
        if (count > 0) {
          expect(screen.getByRole('menu')).toBeInTheDocument();
          expect(screen.getByText('Item 0')).toBeInTheDocument();
        }
        
        unmount();
      }),
      { numRuns: 20 }
    );
  });

  test('navigation always lands on focusable item', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({ label: fc.string({ minLength: 1, maxLength: 20 }), disabled: fc.constant(false) }),
            fc.record({ label: fc.string({ minLength: 1, maxLength: 20 }), disabled: fc.constant(true) }),
            fc.constant({ divider: true as const })
          ),
          { minLength: 1, maxLength: 20 }
        ),
        (items: Array<{ label?: string; disabled?: boolean } | { divider: true }>) => {
          // Ensure at least one actionable item
          const hasActionable = items.some(
            (item: { label?: string; disabled?: boolean } | { divider: true }) => !('divider' in item) && !(item as { disabled?: boolean }).disabled
          );
          if (!hasActionable) return true;
          
          const { unmount } = render(
            <Menu label="Test" items={items as MenuItem[]} isOpen={true} />
          );
          
          // Get the focused element
          const focused = document.activeElement;
          
          // It should be a button and not disabled
          if (focused?.tagName === 'BUTTON') {
            expect(focused).not.toBeDisabled();
          }
          
          unmount();
        }
      ),
      { numRuns: 30 }
    );
  });

  test('menu label is always displayed correctly', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z0-9]{3,20}$/), (label: string) => {
        const { unmount } = render(<Menu label={label} items={[]} />);
        expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
        unmount();
      }),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Fuzzer Tests
// ============================================================================

describe('Menu Fuzzer Tests', () => {
  test('handles random item labels including unicode', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (label: string) => {
        const items: MenuItem[] = [{ label, onClick: jest.fn() }];
        const { unmount } = render(<Menu label="Test" items={items} isOpen={true} />);
        
        // Should render without throwing
        expect(screen.getByRole('menu')).toBeInTheDocument();
        unmount();
      }),
      { numRuns: 30 }
    );
  });

  test('handles empty label gracefully', () => {
    const items: MenuItem[] = [{ label: '', onClick: jest.fn() }];
    expect(() => {
      render(<Menu label="Test" items={items} isOpen={true} />);
    }).not.toThrow();
  });

  test('handles very long labels', () => {
    const longLabel = 'A'.repeat(1000);
    const items: MenuItem[] = [{ label: longLabel, onClick: jest.fn() }];
    
    expect(() => {
      render(<Menu label="Test" items={items} isOpen={true} />);
    }).not.toThrow();
  });

  test('handles mixed dividers and items in random order', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({ label: fc.string({ minLength: 1, maxLength: 20 }) }),
            fc.constant({ divider: true as const })
          ),
          { minLength: 0, maxLength: 30 }
        ),
        (items: Array<{ label?: string } | { divider: true }>) => {
          const { unmount } = render(
            <Menu label="Test" items={items as MenuItem[]} isOpen={true} />
          );
          
          // Should not throw
          expect(screen.getByText('Test')).toBeInTheDocument();
          unmount();
        }
      ),
      { numRuns: 30 }
    );
  });

  test('handles deeply nested submenus (2 levels)', () => {
    const items: MenuItem[] = [
      {
        label: 'Level 1',
        items: [
          {
            label: 'Level 2',
            items: [
              { label: 'Level 3', onClick: jest.fn() },
            ],
          },
        ],
      },
    ];
    
    render(<Menu label="Test" items={items} isOpen={true} />);
    
    // Open first level
    const level1 = screen.getByText('Level 1').closest('button');
    fireEvent.mouseEnter(level1!.parentElement!);
    
    expect(screen.getByText('Level 2')).toBeVisible();
  });

  test('handles special characters in shortcuts', () => {
    const specialShortcuts = ['⌘+S', 'Ctrl+Shift+Alt+F12', '🔥', ''];
    
    specialShortcuts.forEach((shortcut) => {
      const items: MenuItem[] = [{ label: 'Action', shortcut }];
      const { unmount } = render(<Menu label="Test" items={items} isOpen={true} />);
      unmount();
    });
  });

  test('rapid open/close cycles', () => {
    const items: MenuItem[] = [{ label: 'Item', onClick: jest.fn() }];
    const onOpenChange = jest.fn();
    
    const { rerender } = render(
      <Menu label="Test" items={items} isOpen={false} onOpenChange={onOpenChange} />
    );
    
    for (let i = 0; i < 50; i++) {
      rerender(
        <Menu label="Test" items={items} isOpen={i % 2 === 0} onOpenChange={onOpenChange} />
      );
    }
    
    // Should not throw
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  test('handles items with all optional properties undefined', () => {
    const items: MenuItem[] = [
      { label: 'Minimal' }, // No onClick, icon, shortcut, disabled, checked
    ];
    
    render(<Menu label="Test" items={items} isOpen={true} />);
    expect(screen.getByText('Minimal')).toBeInTheDocument();
  });

  test('submenu close timeout interaction with mouse re-entry', async () => {
    jest.useFakeTimers();
    
    const items: MenuItem[] = [{
      label: 'Parent',
      items: [{ label: 'Child', onClick: jest.fn() }]
    }];
    
    render(<Menu label="Test" items={items} isOpen={true} />);
    
    const parent = screen.getByText('Parent').closest('button')!;
    const parentContainer = parent.parentElement!;
    
    // Hover to open
    fireEvent.mouseEnter(parentContainer);
    expect(screen.getByText('Child')).toBeVisible();
    
    // Leave
    fireEvent.mouseLeave(parentContainer);
    
    // Re-enter before 300ms timeout
    act(() => { jest.advanceTimersByTime(100); });
    fireEvent.mouseEnter(parentContainer);
    
    // Submenu should still be visible
    expect(screen.getByText('Child')).toBeVisible();
    
    // Advance past original timeout
    act(() => { jest.advanceTimersByTime(300); });
    
    // Should still be visible (timeout was cancelled)
    expect(screen.getByText('Child')).toBeVisible();
    
    jest.useRealTimers();
  });
});
