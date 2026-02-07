'use client';

import { useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface ToolPanelProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function ToolPanel({ title, isOpen, onClose, children }: ToolPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        // Don't close if clicking a toolbar button
        const target = event.target as HTMLElement;
        if (target.closest('.toolbar-button') || target.closest('.toolbar')) return;
        onClose();
      }
    };

    // Delay adding listener to avoid immediate close from the triggering click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 50);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="fixed left-16 top-28 z-50 w-56 rounded-xl border border-border bg-card shadow-xl animate-fade-in overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/50">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <button
          onClick={onClose}
          className="rounded-md p-1 hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      
      {/* Content */}
      <div className="p-1.5 max-h-80 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

interface ToolPanelItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  shortcut?: string;
}

export function ToolPanelItem({ icon: Icon, label, onClick, disabled, shortcut }: ToolPanelItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-between w-full gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{label}</span>
      </div>
      {shortcut && (
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{shortcut}</span>
      )}
    </button>
  );
}

export function ToolPanelDivider() {
  return <div className="my-1 border-t border-border mx-2" />;
}

export function ToolPanelSection({ title }: { title: string }) {
  return (
    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {title}
    </div>
  );
}
