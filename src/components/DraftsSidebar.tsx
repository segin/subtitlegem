"use client";

import { useState, useEffect } from "react";
import { FileVideo, Trash2, FolderOpen, Clock, X, Menu } from "lucide-react";

interface Draft {
  id: string;
  name: string;
  videoPath?: string;
  createdAt: string;
  updatedAt: string;
}

interface DraftsSidebarProps {
  onLoadDraft: (draft: Draft) => void;
  drafts: Draft[];
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

  const handleDelete = async (id: string) => {
    if (onDelete) {
      onDelete(id);
      setDeleteConfirm(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (drafts.length === 0 && !loading) {
    return null; // Hide sidebar if no drafts
  }

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
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1e1e1e]">
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
            <div
              key={draft.id}
              className="group border-b border-[#333333] hover:bg-[#2a2d2e] transition-colors"
            >
              <button
                onClick={() => {
                  onLoadDraft(draft);
                  if (!isDesktop) setIsOpen(false);
                }}
                className="w-full p-3 text-left"
              >
                <div className="flex items-start gap-2">
                  <FileVideo className="w-4 h-4 text-[#0e639c] shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#e1e1e1] truncate font-medium">
                      {draft.name}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-[#666666] mt-0.5">
                      <Clock className="w-3 h-3" />
                      {formatDate(draft.updatedAt)}
                    </div>
                  </div>
                </div>
              </button>

              {/* Delete button */}
              <div className="px-3 pb-2 flex justify-end">
                {deleteConfirm === draft.id ? (
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-[#888888] font-medium">Delete?</span>
                    <button
                      onClick={() => handleDelete(draft.id)}
                      className="px-2 py-0.5 bg-red-600/20 text-red-400 border border-red-900/50 rounded hover:bg-red-600/30 transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-2 py-0.5 bg-[#3e3e42] text-[#888888] rounded hover:bg-[#4e4e52] transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(draft.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#666666] hover:text-red-400 transition-all"
                    title="Delete project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
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

