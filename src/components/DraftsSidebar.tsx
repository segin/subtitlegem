"use client";

import { useState, useEffect } from "react";
import { FileVideo, Trash2, FolderOpen, Clock } from "lucide-react";

interface Draft {
  id: string;
  name: string;
  videoPath?: string;
  createdAt: string;
  updatedAt: string;
}

interface DraftsSidebarProps {
  onLoadDraft: (draft: Draft) => void;
  className?: string;
}

export function DraftsSidebar({ onLoadDraft, className = "" }: DraftsSidebarProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchDrafts = async () => {
    try {
      const res = await fetch("/api/drafts");
      const data = await res.json();
      setDrafts(data.drafts || []);
    } catch (err) {
      console.error("Failed to load drafts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/drafts?id=${id}`, { method: "DELETE" });
      setDrafts(drafts.filter(d => d.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Failed to delete draft:", err);
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

  return (
    <div className={`w-64 bg-[#252526] border-r border-[#333333] flex flex-col ${className}`}>
      {/* Header */}
      <div className="h-8 bg-[#333333] flex items-center px-3 text-xs font-semibold text-[#cccccc] select-none shrink-0">
        <FolderOpen className="w-3.5 h-3.5 mr-1.5 text-[#888888]" />
        Recent Projects
      </div>

      {/* Drafts List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="p-4 text-center text-xs text-[#666666]">
            Loading...
          </div>
        ) : (
          drafts.map(draft => (
            <div
              key={draft.id}
              className="group border-b border-[#333333] hover:bg-[#2a2d2e] transition-colors"
            >
              <button
                onClick={() => onLoadDraft(draft)}
                className="w-full p-3 text-left"
              >
                <div className="flex items-start gap-2">
                  <FileVideo className="w-4 h-4 text-[#0e639c] shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#e1e1e1] truncate">
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
                    <span className="text-[#888888]">Delete?</span>
                    <button
                      onClick={() => handleDelete(draft.id)}
                      className="px-2 py-0.5 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-2 py-0.5 bg-[#3e3e42] text-[#888888] rounded hover:bg-[#4e4e52]"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(draft.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#666666] hover:text-red-400 transition-all"
                    title="Delete draft"
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
      <div className="p-2 border-t border-[#333333] text-[9px] text-[#555555] text-center">
        {drafts.length} incomplete project{drafts.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
