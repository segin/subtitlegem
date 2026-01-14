"use client";

import React, { useState, useEffect } from "react";
import { X, Check, Edit2, Loader2 } from "lucide-react";

interface RenameProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
  currentName: string;
}

export function RenameProjectModal({
  isOpen,
  onClose,
  onRename,
  currentName,
}: RenameProjectModalProps) {
  const [newName, setNewName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
      setError(null);
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setError("Name cannot be empty");
      return;
    }
    if (newName === currentName) {
      onClose();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onRename(newName.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to rename project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#252526] border border-[#454545] shadow-2xl w-full max-w-md rounded-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="h-10 bg-[#333333] flex items-center justify-between px-4 text-xs font-semibold text-[#cccccc] select-none shrink-0 border-b border-[#454545]">
          <div className="flex items-center gap-2">
            <Edit2 className="w-3.5 h-3.5" />
            <span>Rename Project</span>
          </div>
          <button 
            onClick={onClose}
            className="hover:bg-[#454545] p-1 rounded transition-colors"
            disabled={loading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-[#666666] tracking-wider">New Project Name</label>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={loading}
              className="w-full bg-[#1e1e1e] border border-[#3e3e42] text-[#cccccc] text-sm p-2 focus:border-[#007acc] outline-none rounded-sm transition-all"
              placeholder="Enter new name..."
            />
            {error && (
              <p className="text-[10px] text-red-500 animate-in fade-in slide-in-from-top-1">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-1.5 text-xs text-[#cccccc] hover:bg-[#333333] rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !newName.trim()}
              className="px-4 py-1.5 bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 text-white text-xs font-medium rounded transition-all flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Renaming...</span>
                </>
              ) : (
                <>
                  <Check className="w-3 h-3" />
                  <span>Rename</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
