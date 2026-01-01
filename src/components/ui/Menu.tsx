"use client";

import React, { useState, useRef, useEffect, useCallback, useId } from "react";

// ============================================================================
// Types
// ============================================================================

export interface MenuItemBase {
  id?: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: (e?: React.MouseEvent) => void;
  disabled?: boolean;
  checked?: boolean;
  showOnUploadScreen?: boolean;
}

export interface MenuDivider {
  divider: true;
}

export type MenuItem = MenuItemBase | MenuDivider;

export interface MenuProps {
  label: string;
  items: MenuItem[];
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onNavigateLeft?: () => void;
  onNavigateRight?: () => void;
  isAnyMenuOpen?: boolean;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

// ============================================================================
// Helpers
// ============================================================================

function isActionableItem(item: MenuItem): item is MenuItemBase {
  return !('divider' in item) && !item.disabled;
}

function getNextFocusableIndex(items: MenuItem[], currentIndex: number, direction: 1 | -1): number {
  const len = items.length;
  let nextIndex = currentIndex;
  
  for (let i = 0; i < len; i++) {
    nextIndex = (nextIndex + direction + len) % len;
    if (isActionableItem(items[nextIndex])) {
      return nextIndex;
    }
  }
  return currentIndex;
}

function getFirstFocusableIndex(items: MenuItem[]): number {
  return items.findIndex(isActionableItem);
}

function getLastFocusableIndex(items: MenuItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (isActionableItem(items[i])) return i;
  }
  return -1;
}

// ============================================================================
// Menu Component
// ============================================================================

export function Menu({
  label,
  items,
  isOpen: controlledIsOpen,
  onOpenChange,
  onNavigateLeft,
  onNavigateRight,
  isAnyMenuOpen = false,
  triggerRef: externalTriggerRef,
}: MenuProps) {
  // Use controlled or uncontrolled state
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  
  const setIsOpen = useCallback((open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalIsOpen(open);
    }
  }, [onOpenChange]);

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const internalTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerRef = externalTriggerRef || internalTriggerRef;
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  
  const menuId = useId();
  const triggerId = useId();

  // Reset focus when menu opens
  useEffect(() => {
    if (isOpen) {
      const firstIndex = getFirstFocusableIndex(items);
      setFocusedIndex(firstIndex);
      // Focus the first item after render
      requestAnimationFrame(() => {
        itemRefs.current[firstIndex]?.focus();
      });
    } else {
      setFocusedIndex(-1);
    }
  }, [isOpen, items]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setIsOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        const nextDown = getNextFocusableIndex(items, focusedIndex, 1);
        setFocusedIndex(nextDown);
        itemRefs.current[nextDown]?.focus();
        break;
        
      case "ArrowUp":
        e.preventDefault();
        const nextUp = getNextFocusableIndex(items, focusedIndex, -1);
        setFocusedIndex(nextUp);
        itemRefs.current[nextUp]?.focus();
        break;
        
      case "ArrowLeft":
        e.preventDefault();
        setIsOpen(false);
        onNavigateLeft?.();
        break;
        
      case "ArrowRight":
        e.preventDefault();
        setIsOpen(false);
        onNavigateRight?.();
        break;
        
      case "Home":
        e.preventDefault();
        const first = getFirstFocusableIndex(items);
        setFocusedIndex(first);
        itemRefs.current[first]?.focus();
        break;
        
      case "End":
        e.preventDefault();
        const last = getLastFocusableIndex(items);
        setFocusedIndex(last);
        itemRefs.current[last]?.focus();
        break;
        
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
        
      case "Enter":
      case " ":
        e.preventDefault();
        const item = items[focusedIndex];
        if (item && isActionableItem(item)) {
          setIsOpen(false);
          item.onClick?.();
        }
        break;
    }
  }, [isOpen, items, focusedIndex, setIsOpen, onNavigateLeft, onNavigateRight]);

  // Handle keyboard on trigger button (when menu is closed)
  const handleTriggerKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        onNavigateLeft?.();
        break;
      case "ArrowRight":
        e.preventDefault();
        onNavigateRight?.();
        break;
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        setIsOpen(true);
        break;
      case "Escape":
        if (isOpen) {
          e.preventDefault();
          setIsOpen(false);
        }
        break;
    }
  }, [onNavigateLeft, onNavigateRight, setIsOpen, isOpen]);

  // Hover-to-open when another menu is already open
  const handleTriggerMouseEnter = () => {
    if (isAnyMenuOpen && !isOpen) {
      setIsOpen(true);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={triggerRef}
        id={triggerId}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={handleTriggerMouseEnter}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        className={`px-2 py-0.5 text-xs rounded-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:ring-offset-1 focus:ring-offset-[#333333] ${
          isOpen ? "bg-[#3e3e42]" : "hover:bg-[#3e3e42]"
        }`}
      >
        {label}
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={handleKeyDown}
          className="absolute top-full left-0 mt-0.5 w-56 bg-[#252526] border border-[#454545] shadow-xl z-50 py-1 origin-top animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {items.map((item, index) =>
            'divider' in item ? (
              <div key={index} role="separator" className="h-px bg-[#454545] my-1" />
            ) : (
              <button
                key={item.id || index}
                ref={(el) => { itemRefs.current[index] = el; }}
                role="menuitem"
                tabIndex={focusedIndex === index ? 0 : -1}
                aria-disabled={item.disabled}
                onClick={(e) => {
                  if (item.disabled) return;
                  setIsOpen(false);
                  item.onClick?.(e);
                }}
                onMouseEnter={() => {
                  if (!item.disabled) {
                    setFocusedIndex(index);
                  }
                }}
                disabled={item.disabled}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors outline-none ${
                  item.disabled
                    ? "text-[#555555] cursor-not-allowed"
                    : focusedIndex === index
                      ? "bg-[#094771] text-white"
                      : "text-[#cccccc] hover:bg-[#094771]"
                }`}
              >
                <span className="flex items-center gap-2">
                  {item.checked !== undefined && (
                    <span className="w-4 text-center">
                      {item.checked ? "✓" : ""}
                    </span>
                  )}
                  {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                  {item.label}
                </span>
                {item.shortcut && (
                  <span className="text-[#888888] text-[10px]">{item.shortcut}</span>
                )}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
