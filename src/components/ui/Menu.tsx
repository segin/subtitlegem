"use client";

import React, { useState, useRef, useEffect, useCallback, useId } from "react";
import { Check, ChevronRight } from "lucide-react";

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
  items?: MenuItem[];
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
  }, [isOpen]); // Removed items from dependency to prevent focus jumping

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
        // If the current item has a sub-menu, don't move left/right between main menus
        const currentItem = items[focusedIndex];
        if (currentItem && !('divider' in currentItem) && currentItem.items) {
           // Submenu handling is inside SubMenuItem
           return;
        }
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
          if (!item.items) {
            setIsOpen(false);
            item.onClick?.();
          }
        }
        break;
    }
  }, [isOpen, items, focusedIndex, setIsOpen, onNavigateLeft, onNavigateRight, triggerRef]);

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
          {items.map((item, index) => {
            if ('divider' in item) {
              return <div key={index} className="h-px bg-[#454545] my-1 mx-2" role="separator" />;
            }

            if (item.items) {
              return (
                <SubMenuItem 
                  key={index} 
                  item={item} 
                  onClose={() => setIsOpen(false)} 
                  ref={(el) => { itemRefs.current[index] = el; }}
                  tabIndex={focusedIndex === index ? 0 : -1}
                />
              );
            }

            return (
              <button
                key={index}
                ref={(el) => { itemRefs.current[index] = el; }}
                role="menuitem"
                tabIndex={focusedIndex === index ? 0 : -1}
                disabled={item.disabled}
                onClick={() => {
                  setIsOpen(false);
                  item.onClick?.();
                }}
                onMouseEnter={() => setFocusedIndex(index)}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors outline-none ${
                  item.disabled
                    ? "text-[#555555] cursor-not-allowed"
                    : focusedIndex === index
                      ? "bg-[#094771] text-white"
                      : "text-[#cccccc] hover:bg-[#094771] hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-4 flex items-center justify-center">
                    {item.checked ? <Check className="w-3 h-3 text-[#007acc]" data-testid="check-icon" /> : item.icon}
                  </span>
                  {item.label}
                </span>
                {item.shortcut && (
                  <span className={`text-[10px] ${focusedIndex === index ? "text-white/70" : "text-[#888888] group-hover:text-white/70"}`}>
                    {item.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============= SUBMENU COMPONENT =============

interface SubMenuItemProps {
  item: MenuItemBase;
  onClose: () => void;
  tabIndex: number;
}

const SubMenuItem = React.forwardRef<HTMLButtonElement, SubMenuItemProps>(({ item, onClose, tabIndex }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const subItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>(null);
  const innerRef = useRef<HTMLButtonElement>(null);

  const setRef = useCallback((node: HTMLButtonElement | null) => {
    innerRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }, [ref]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(true);
        const first = getFirstFocusableIndex(item.items!);
        setFocusedIndex(first);
        requestAnimationFrame(() => subItemRefs.current[first]?.focus());
      }
      return;
    }

    e.stopPropagation();

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        const prev = getNextFocusableIndex(item.items!, focusedIndex, -1);
        setFocusedIndex(prev);
        subItemRefs.current[prev]?.focus();
        break;
      case "ArrowDown":
        e.preventDefault();
        const next = getNextFocusableIndex(item.items!, focusedIndex, 1);
        setFocusedIndex(next);
        subItemRefs.current[next]?.focus();
        break;
      case "ArrowLeft":
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        innerRef.current?.focus();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        const subItem = item.items![focusedIndex];
        if (subItem && isActionableItem(subItem)) {
          onClose();
          subItem.onClick?.();
        }
        break;
    }
  };

  return (
    <div 
      className="relative" 
      onMouseEnter={handleMouseEnter} 
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={setRef}
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        tabIndex={tabIndex}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors outline-none ${
          isOpen || tabIndex === 0
            ? "bg-[#094771] text-white"
            : "text-[#cccccc] hover:bg-[#094771]"
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="w-4 flex items-center justify-center">{item.icon}</span>
          {item.label}
        </span>
        <ChevronRight className="w-3 h-3 text-[#888888]" />
      </button>

      {isOpen && item.items && (
        <div 
          className="absolute left-full top-0 ml-[-2px] w-56 bg-[#252526] border border-[#454545] shadow-xl z-[60] py-1"
          role="menu"
          onKeyDown={handleKeyDown}
        >
          {item.items.map((subItem, index) => {
            if ('divider' in subItem) {
              return <div key={index} className="h-px bg-[#454545] my-1 mx-2" role="separator" />;
            }
            return (
              <button
                key={index}
                ref={(el) => { subItemRefs.current[index] = el; }}
                role="menuitem"
                tabIndex={focusedIndex === index ? 0 : -1}
                disabled={subItem.disabled}
                onClick={() => {
                  onClose();
                  subItem.onClick?.();
                }}
                onMouseEnter={() => setFocusedIndex(index)}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors outline-none ${
                  subItem.disabled
                    ? "text-[#555555] cursor-not-allowed"
                    : focusedIndex === index
                      ? "bg-[#094771] text-white"
                      : "text-[#cccccc] hover:bg-[#094771]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-4 flex items-center justify-center">
                    {subItem.checked ? <Check className="w-3 h-3 text-[#007acc]" /> : subItem.icon}
                  </span>
                  {subItem.label}
                </span>
                {subItem.shortcut && (
                  <span className={`text-[10px] ${focusedIndex === index ? "text-white/70" : "text-[#888888]"}`}>
                    {subItem.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
SubMenuItem.displayName = "SubMenuItem";
