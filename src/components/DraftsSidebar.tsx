
"use client";

import { useState, useEffect } from "react";
import { FolderOpen, X, Menu } from "lucide-react";
import { ProjectCard } from "./ProjectCard";
import { DraftItem } from "@/hooks/useHomeState";

// Using DraftItem from hook for consistency
interface DraftsSidebarProps {
  onLoadDraft: (draft: DraftItem) => void;
  drafts: DraftItem[];
  loading?: boolean;
  onDelete?: (id: string) => void;
  className?: string;
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

export function DraftsSidebar({ drafts, loading = false, onLoadDraft, onDelete, className = "" }: DraftsSidebarProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isDesktop = useIsDesktop();

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent card click
    
    if (deleteConfirm === id) {
      if (onDelete) {
        onDelete(id);
        setDeleteConfirm(null);
      }
    } else {
        setDeleteConfirm(id);
    }
  };

  const renderSidebarContent = () => (
    <>
      {/* Header */}
      <div className="h-10 bg-[#333333] flex items-center justify-between px-3 text-xs font-semibold text-[#cccccc] select-none shrink-0 border-b border-[#454545]">
        <div className="flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5 text-[#888888]" />
          <span>RECENT PROJECTS</span>
        </div>
        {!isDesktop && (
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-[#454545] rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Drafts List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1e1e1e] px-2 py-2">
        {loading ? (
          <div className="p-4 text-center text-xs text-[#666666] flex flex-col items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#007acc] border-t-transparent rounded-full animate-spin" />
            Loading projects...
          </div>
        ) : drafts.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#555555]">
            No recent projects found.
          </div>
        ) : (
          drafts.map(draft => (
             <div key={draft.id}>
                {deleteConfirm === draft.id ? (
                  // Delete Confirmation State
                  <div className="mb-2 p-2 bg-red-900/20 border border-red-500/30 rounded flex items-center justify-between">
                     <span className="text-xs text-red-200">Confirm Delete?</span>
                     <div className="flex gap-2">
                        <button 
                          onClick={(e) => handleDelete(e, draft.id)}
                          className="px-2 py-0.5 text-[10px] bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Yes
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                          className="px-2 py-0.5 text-[10px] bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                        >
                          No
                        </button>
                     </div>
                  </div>
                ) : (
                  <ProjectCard
                    draft={draft}
                    isSelected={false} 
                    onClick={() => {
                        onLoadDraft(draft);
                        if (!isDesktop) setIsOpen(false);
                    }}
                    onDelete={(e) => handleDelete(e, draft.id)}
                  />
                )}
             </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-[#333333] text-[9px] text-[#555555] text-center bg-[#252526]">
        {drafts.length} incomplete project{drafts.length !== 1 ? "s" : ""}
      </div>
    </>
  );

  if (drafts.length === 0 && !loading) {
    // If no drafts and not loading, we still show the sidebar skeleton or hidden?
    // Existing logic was: return null if length=0 && !loading.
    // But RenderSidebarContent uses drafts.length check too.
    // Let's stick to existing behavior: Hide sidebar if empty.
    // BUT we need content to render if NOT empty.
    // Wait, the original code had `if (drafts.length === 0 && !loading) return null;`
    // I should put that check at the top of the component render, NOT inside.
  }

  // Correction: Put the empty check here if we want to hide the whole sidebar.
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
        <div className={`w-72 bg-[#252526] border-r border-[#333333] flex flex-col shrink-0 ${className}`}>
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
