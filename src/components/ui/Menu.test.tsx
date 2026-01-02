import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
