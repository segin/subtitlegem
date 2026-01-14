
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FolderOpen, X, Menu, Maximize2, Minimize2 } from "lucide-react";
import { ProjectCard } from "./ProjectCard";
import { RenameProjectModal } from "./RenameProjectModal";
import { DraftItem } from "@/hooks/useHomeState";

// Using DraftItem from hook for consistency
interface DraftsSidebarProps {
  onLoadDraft: (draft: DraftItem) => void;
  drafts: DraftItem[];
  loading?: boolean;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newName: string) => Promise<void>;
  onReorder?: (orderedIds: string[]) => void;
  className?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

// Custom hook to detect desktop (lg breakpoint = 1024px)
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  return isDesktop;
}

export function DraftsSidebar({ 
  drafts, 
  loading = false, 
  onLoadDraft, 
  onDelete, 
  onRename, 
  onReorder, 
  className = "",
  isExpanded = false,
  onToggleExpand
}: DraftsSidebarProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [renamingDraft, setRenamingDraft] = useState<DraftItem | null>(null);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const isDesktop = useIsDesktop();
  
  // Drag and drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const dragStartIndex = useRef<number>(-1);
  const canDragRef = useRef(false);

  // Sync local order with drafts
  useEffect(() => {
    setLocalOrder(drafts.map(d => d.id));
  }, [drafts]);

  // Get ordered drafts based on local order
  const orderedDrafts = localOrder
    .map(id => drafts.find(d => d.id === id))
    .filter((d): d is DraftItem => d !== undefined);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent card click
    
    if (deleteConfirm === id) {
      if (onDelete) {
        setDeletingIds(prev => [...prev, id]);
        setTimeout(() => {
          onDelete(id);
          setDeleteConfirm(null);
          setDeletingIds(prev => prev.filter(itemId => itemId !== id));
        }, 300);
      }
    } else {
        setDeleteConfirm(id);
    }
  };

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, id: string, index: number) => {
    // Only allow drag if it started from the handle
    if (!canDragRef.current) {
      e.preventDefault();
      return;
    }

    setDraggedId(id);
    dragStartIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    
    // Add a slight delay before showing the drop zone
    setTimeout(() => setDragOverIndex(index), 0);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedId && index !== dragOverIndex) {
      setDragOverIndex(index);
    }
  }, [draggedId, dragOverIndex]);

  const handleDragEnd = useCallback(() => {
    if (draggedId && dragOverIndex !== null && dragStartIndex.current !== dragOverIndex) {
      // Reorder the local list
      const newOrder = [...localOrder];
      const draggedIndex = newOrder.indexOf(draggedId);
      
      if (draggedIndex !== -1) {
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(dragOverIndex, 0, draggedId);
        setLocalOrder(newOrder);
        
        // Notify parent of new order
        if (onReorder) {
          onReorder(newOrder);
        }
      }
    }
    
    setDraggedId(null);
    setDragOverIndex(null);
    dragStartIndex.current = -1;
    canDragRef.current = false;
  }, [draggedId, dragOverIndex, localOrder, onReorder]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the list entirely
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientY < rect.top || e.clientY > rect.bottom) {
      setDragOverIndex(null);
    }
  }, []);

  const renderSidebarContent = () => (
    <>
      {/* Header */}
      <div className="h-10 bg-[#333333] flex items-center justify-between px-3 text-xs font-semibold text-[#cccccc] select-none shrink-0 border-b border-[#454545]">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <FolderOpen className="w-3.5 h-3.5 text-[#888888] shrink-0" />
          <span className="truncate">{isExpanded ? 'ALL PROJECTS' : 'RECENT PROJECTS'}</span>
        </div>
        <div className="flex items-center gap-1">
          {isDesktop && onToggleExpand && (
            <button 
              onClick={onToggleExpand}
              className="p-1.5 hover:bg-[#454545] rounded-md transition-all duration-200 hover:scale-110 active:scale-95"
                title={isExpanded ? "Collapse Sidebar" : "Full Screen Projects"}
            >
              <div className="transition-transform duration-300 ease-out" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </div>
            </button>
          )}
          {!isDesktop && (
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-[#454545] rounded transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Drafts List */}
      <div 
        className="flex-1 overflow-y-auto custom-scrollbar bg-[#1e1e1e] px-2 py-2"
        onDragLeave={handleDragLeave}
      >
        <div className={isExpanded ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "flex flex-col"}>
        {loading ? (
          <div className="col-span-full p-4 text-center text-xs text-[#666666] flex flex-col items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#007acc] border-t-transparent rounded-full animate-spin" />
            Loading projects...
          </div>
        ) : orderedDrafts.length === 0 ? (
          <div className="col-span-full p-8 text-center text-xs text-[#555555]">
            No recent projects found.
          </div>
        ) : (
          orderedDrafts.map((draft, index) => (
            <div 
              key={draft.id}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={handleDragEnd}
            >
              {/* Drop zone indicator (animated) */}
              <div 
                className={`
                  transition-all duration-200 ease-out overflow-hidden
                  ${dragOverIndex === index && draggedId !== draft.id 
                    ? 'h-12 mb-2 bg-blue-500/20 border-2 border-dashed border-blue-500/50 rounded-lg' 
                    : 'h-0'}
                `}
              />
              
              {deleteConfirm === draft.id ? (
                // Delete Confirmation State with animation
                <div className="mb-2 p-3 bg-red-900/30 border border-red-500/40 rounded-lg animate-in fade-in zoom-in-95 duration-200 shadow-lg shadow-red-500/10">
                   <div className="flex items-center justify-between">
                     <span className="text-xs text-red-200 font-medium">Delete this project?</span>
                     <div className="flex gap-2">
                        <button 
                          onClick={(e) => handleDelete(e, draft.id)}
                          className="px-3 py-1 text-[10px] font-medium bg-red-600 text-white rounded-md hover:bg-red-500 transition-all duration-150 hover:scale-105 shadow-sm"
                        >
                          Delete
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                          className="px-3 py-1 text-[10px] font-medium bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-all duration-150 hover:scale-105"
                        >
                          Cancel
                        </button>
                     </div>
                   </div>
                </div>
              ) : (
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, draft.id, index)}
                  onDragEnd={handleDragEnd}
                  className={`transition-all duration-300 ease-out ${deletingIds.includes(draft.id) ? 'opacity-0 scale-95 -translate-x-4 max-h-0 mb-0 pointer-events-none' : 'max-h-[500px] mb-0'}`}
                >
                  <ProjectCard
                    draft={draft}
                    isSelected={false} 
                    isDragging={draggedId === draft.id}
                    onClick={() => {
                        onLoadDraft(draft);
                        if (!isDesktop) setIsOpen(false);
                    }}
                    onDelete={(e) => handleDelete(e, draft.id)}
                    onRename={(e) => {
                      e.stopPropagation();
                      setRenamingDraft(draft);
                    }}
                    dragHandleProps={{
                      onMouseDown: () => { canDragRef.current = true; },
                      onMouseUp: () => { canDragRef.current = false; },
                      onMouseLeave: () => { if (!draggedId) canDragRef.current = false; }
                    }}
                    forceExpanded={isExpanded}
                    animationDelay={index * 50}
                  />
                </div>
              )}
            </div>
          ))
        )}
        </div>
        
        {/* Final drop zone (for dropping at the end) */}
        {draggedId && (
          <div 
            onDragOver={(e) => handleDragOver(e, orderedDrafts.length)}
            onDrop={handleDragEnd}
            className={`
              transition-all duration-200 ease-out
              ${dragOverIndex === orderedDrafts.length 
                ? 'h-12 bg-blue-500/20 border-2 border-dashed border-blue-500/50 rounded-lg' 
                : 'h-8'}
            `}
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-2.5 border-t border-[#333333] text-[10px] text-[#666666] text-center bg-[#252526] transition-all duration-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="font-medium text-[#888888]">{drafts.length}</span>
          <span>project{drafts.length !== 1 ? "s" : ""}</span>
        </span>
      </div>

      <RenameProjectModal
        isOpen={!!renamingDraft}
        onClose={() => setRenamingDraft(null)}
        currentName={renamingDraft?.name || ""}
        onRename={async (newName) => {
          if (renamingDraft && onRename) {
            await onRename(renamingDraft.id, newName);
          }
        }}
      />
    </>
  );

  if (drafts.length === 0 && !loading) {
     return null;
  }

  return (
    <>
      {/* MOBILE: Toggle Button */}
      {!isDesktop && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 z-40 p-3 bg-[#0e639c] text-white rounded-full shadow-lg hover:bg-[#1177bb] transition-all active:scale-95 flex items-center gap-2"
        >
          <Menu className="w-5 h-5" />
          <span className="text-xs font-bold mr-1">PROJECTS</span>
          {drafts.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] flex items-center justify-center border-2 border-[#1e1e1e]">
              {drafts.length}
            </span>
          )}
        </button>
      )}

      {/* MOBILE: Backdrop */}
      {!isDesktop && isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* DESKTOP: Inline Sidebar */}
      {isDesktop && (
        <div className={`
          ${isExpanded ? 'flex-1' : 'w-72'} 
          bg-[#252526] border-r border-[#333333] flex flex-col ${isExpanded ? '' : 'shrink-0'} transition-all duration-300 ease-in-out
          ${className}
        `}>
          {renderSidebarContent()}
        </div>
      )}

      {/* MOBILE: Slide-out Drawer */}
      {!isDesktop && (
        <div 
          className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-[#252526] border-r border-[#333333] shadow-2xl z-[101] transform transition-transform duration-300 ease-in-out flex flex-col ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderSidebarContent()}
        </div>
      )}
    </>
  );
}
