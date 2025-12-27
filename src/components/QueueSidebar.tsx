"use client";

import React from "react";
import { QueueItem } from "@/lib/queue-manager";
import { Pencil, Trash2, Loader2, CheckCircle, XCircle, Clock, Download, AlertTriangle, RotateCcw } from "lucide-react";

interface QueueSidebarProps {
  items: QueueItem[];
  onEdit: (item: QueueItem) => void;
  onRemove: (id: string) => void;
}

export function QueueSidebar({ items, onEdit, onRemove }: QueueSidebarProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '--:--';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusIcon = (status: QueueItem['status'], failureReason?: QueueItem['failureReason']) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-4 h-4 text-[#007acc] animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        // Different icon for crash failures
        if (failureReason === 'crash') {
          return (
            <div title="Server crash during processing">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            </div>
          );
        }
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-[#888888]" />;
    }
  };

  const getStatusText = (status: QueueItem['status']) => {
    switch (status) {
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'pending':
        return 'Queued';
    }
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const processingItem = items.find(i => i.status === 'processing');
  const activeItems = items.filter(i => i.status === 'pending' || i.status === 'processing' || i.status === 'failed');
  const completedItems = items.filter(i => i.status === 'completed');

  const handleDownload = async (item: QueueItem) => {
    // Download the completed video
    if (!item.result) return;
    
    // TODO: Implement download from /api/download/:jobId
    alert('Download feature coming soon! Job ID: ' + item.id);
  };

  const handleCloseout = async (id: string) => {
    if (!confirm('Delete all job data including source video and finished video?')) {
      return;
    }
    
    // Remove from queue and cleanup files
    await onRemove(id);
    
    // TODO: Call cleanup API to delete all associated files
  };

  return (
    <div className="w-80 border-l border-[#333333] bg-[#252526] flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="h-8 border-b border-[#333333] flex items-center justify-between px-3 bg-[#2d2d2d]">
        <h3 className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">
          Queue ({items.length})
        </h3>
        {pendingCount > 0 && (
          <span className="text-[10px] text-[#007acc] font-mono">
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Active Queue Items (Upper 75%) */}
      <div className="flex-[3] overflow-y-auto custom-scrollbar border-b border-[#333333]">
        {activeItems.length === 0 ? (
          <div className="p-6 text-center text-[#666666] text-sm">
            No active items
          </div>
        ) : (
          <div className="divide-y divide-[#333333]">
            {activeItems.map((item) => {
              const isProcessing = item.status === 'processing';
              const canEdit = item.status === 'pending' || item.status === 'failed';

              return (
                <div
                  key={item.id}
                  className={`p-3 transition-colors ${
                    isProcessing 
                      ? 'bg-[#264f78] border-l-2 border-[#007acc]' 
                      : 'hover:bg-[#2d2d2d]'
                  }`}
                >
                  {/* File name and status */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center space-x-2 mb-1">
                        {getStatusIcon(item.status, item.failureReason)}
                        <span className="text-xs font-medium text-[#e1e1e1] truncate">
                          {item.file.name}
                        </span>
                        {item.failureReason === 'crash' && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-orange-950/30 text-orange-400 border border-orange-900/50 rounded" title="Will retry - server crashed">
                            CRASH
                          </span>
                        )}
                        {item.retryCount && item.retryCount > 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-[#2d2d2d] text-[#888888] border border-[#333333] rounded" title={`Retried ${item.retryCount} time(s)`}>
                            ×{item.retryCount}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#888888] font-mono">
                        {formatFileSize(item.file.size)}
                        {item.sampleDuration && (
                          <span className="ml-2 text-[#d7ba7d]">
                            Sample: {item.sampleDuration}s
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-1">
                      {canEdit && (
                        <>
                          <button
                            onClick={() => onEdit(item)}
                            className="p-1.5 rounded-sm hover:bg-[#3e3e42] text-[#888888] hover:text-[#007acc] transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onRemove(item.id)}
                            className="p-1.5 rounded-sm hover:bg-[#3e3e42] text-[#888888] hover:text-red-400 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status and progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#888888]">{getStatusText(item.status)}</span>
                      {isProcessing && (
                        <span className="font-mono text-[#007acc]">
                          {item.progress}%
                        </span>
                      )}
                    </div>

                    {isProcessing && (
                      <div className="w-full bg-[#333333] h-1 rounded-full overflow-hidden">
                        <div
                          className="bg-[#007acc] h-full transition-all duration-200"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}

                    {item.error && (
                      <div className="text-[10px] text-red-400 mt-1">
                        {item.error}
                      </div>
                    )}
                  </div>

                  {/* Model and language */}
                  <div className="mt-2 flex items-center space-x-2 text-[9px] text-[#666666]">
                    <span>{item.model}</span>
                    {item.secondaryLanguage !== 'None' && (
                      <>
                        <span>•</span>
                        <span>{item.secondaryLanguage}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Jobs Section (Lower 25%) */}
      <div className="flex-[1] flex flex-col bg-[#1e1e1e]">
        <div className="h-7 border-b border-[#333333] flex items-center justify-between px-3 bg-[#2d2d2d]">
          <h4 className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">
            Completed ({completedItems.length})
          </h4>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {completedItems.length === 0 ? (
            <div className="p-4 text-center text-[#666666] text-xs">
              No completed jobs
            </div>
          ) : (
            <div className="divide-y divide-[#333333]">
              {completedItems.map((item) => (
                <div key={item.id} className="p-3 hover:bg-[#252526] transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center space-x-2 mb-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span className="text-xs font-medium text-[#e1e1e1] truncate">
                          {item.file.name}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#888888] font-mono">
                        {formatFileSize(item.file.size)}
                      </div>
                    </div>
                  </div>

                  {/* Download and Delete buttons */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDownload(item)}
                      className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 text-xs font-medium bg-[#007acc] hover:bg-[#0062a3] text-white rounded-sm transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </button>
                    <button
                      onClick={() => handleCloseout(item.id)}
                      className="px-3 py-1.5 text-xs font-medium bg-[#2d2d2d] hover:bg-red-950/30 text-[#888888] hover:text-red-400 rounded-sm transition-colors border border-[#333333]"
                      title="Delete all job data"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats footer */}
      {processingItem && (
        <div className="border-t border-[#333333] bg-[#2d2d2d] p-2 text-[10px] text-[#888888]">
          <div className="font-mono text-center truncate">
            Processing: {processingItem.file.name}
          </div>
        </div>
      )}
    </div>
  );
}
