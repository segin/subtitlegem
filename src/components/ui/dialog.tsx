"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  return (
     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div 
          className="absolute inset-0" 
          onClick={() => onOpenChange(false)}
        />
        {/* Pass props to children if needed, but here structure handles it */}
        {children}
     </div>
  );
}

export function DialogContent({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`relative z-50 w-full p-6 shadow-lg bg-[#1e1e1e] border border-[#333333] rounded-lg animate-in fade-in-0 zoom-in-95 ${className}`}>
        {children}
    </div>
  );
}

export function DialogHeader({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <h2 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>
      {children}
    </h2>
  );
}

export function DialogFooter({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6 ${className}`}>
      {children}
    </div>
  );
}
