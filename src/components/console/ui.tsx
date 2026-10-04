'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { AlertTriangle, Inbox, Loader2, X } from 'lucide-react';

export function StatTile({ label, value, detail }: { label: string; value: string; detail?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-foreground">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function Notice({ tone = 'error', children }: { tone?: 'error' | 'warning'; children: ReactNode }) {
  return (
    <p
      role="alert"
      className={`flex items-start gap-2 rounded-xl p-3 text-sm ${tone === 'error' ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
      <Inbox className="mb-2 h-6 w-6" aria-hidden="true" />
      {children}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" aria-label={label} />
    </div>
  );
}

export function Badge({ tone, children }: { tone: 'neutral' | 'success' | 'warning' | 'error' | 'primary'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-muted text-muted-foreground',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    error: 'bg-error/10 text-error',
    primary: 'bg-primary/10 text-primary',
  } as const;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

/** Slide-over panel; full screen on phones. */
export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-label="Close panel" tabIndex={-1} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-background shadow-2xl outline-none sm:border-l sm:border-border"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
          <h2 className="min-w-0 truncate font-display text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}

export function LoadMore({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <div className="mt-4 flex justify-center">
      <button type="button" onClick={onClick} className="btn-outline min-h-11" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Load more
      </button>
    </div>
  );
}
