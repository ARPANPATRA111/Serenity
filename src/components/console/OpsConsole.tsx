'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Award, FileStack, Inbox, Lock, Mail, ScrollText, Users } from 'lucide-react';
import { SerenityMark } from '@/components/brand/SerenityBrand';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { consoleFetch, type ConsoleUsage } from './api';
import { ConsoleContext } from './context';
import { formatExact } from './format';
import { Spinner } from './ui';
import { UnlockPanel } from './UnlockPanel';
import { OverviewTab } from './OverviewTab';
import { UsersTab } from './UsersTab';
import { CertificatesTab } from './CertificatesTab';
import { BatchesTab } from './BatchesTab';
import { EmailsTab } from './EmailsTab';
import { LeadsTab } from './LeadsTab';
import { AuditTab } from './AuditTab';
import { UserDrawer } from './UserDrawer';
import styles from './console.module.css';

type TabId = 'overview' | 'users' | 'certificates' | 'batches' | 'emails' | 'leads' | 'audit';

const TABS: Array<{ id: TabId; label: string; icon: typeof Activity }> = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'certificates', label: 'Certificates', icon: Award },
  { id: 'batches', label: 'Batches', icon: FileStack },
  { id: 'emails', label: 'Deliveries', icon: Mail },
  { id: 'leads', label: 'Pro requests', icon: Inbox },
  { id: 'audit', label: 'Audit log', icon: ScrollText },
];

interface Session {
  email: string | null;
  expiresAt: string;
}

function UsageMeter({ usage }: { usage: ConsoleUsage }) {
  const ratio = usage.budget > 0 ? Math.min(1, usage.reads / usage.budget) : 0;
  const fill = ratio >= 0.9 ? styles.meterDanger : ratio >= 0.7 ? styles.meterWarning : styles.meterFill;
  return (
    <div className={`${styles.viz} min-w-[10rem]`} title="Estimated Firestore reads used by this console today">
      <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
        <span>Console reads today</span>
        <span className="tabular-nums text-foreground">{formatExact(usage.reads)} / {formatExact(usage.budget)}</span>
      </div>
      <div
        className={`${styles.meterTrack} mt-1 h-1.5 overflow-hidden rounded-full`}
        role="meter"
        aria-label="Console reads used today"
        aria-valuemin={0}
        aria-valuemax={usage.budget}
        aria-valuenow={usage.reads}
      >
        <div className={`${fill} h-full rounded-full`} style={{ width: `${Math.max(2, ratio * 100)}%` }} />
      </div>
    </div>
  );
}

export function OpsConsole() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<TabId>('overview');
  const [usage, setUsage] = useState<ConsoleUsage | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleFetch<{ active: boolean; email?: string | null; expiresAt?: string }>('/api/console/session')
      .then((body) => {
        if (!cancelled && body.active && body.expiresAt) setSession({ email: body.email ?? null, expiresAt: body.expiresAt });
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Drop back to the lock screen when the session cookie expires.
  useEffect(() => {
    if (!session) return;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    const timer = window.setTimeout(() => setSession(null), Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [session]);

  const reportUsage = useCallback((next: ConsoleUsage | null | undefined) => {
    if (next) setUsage(next);
  }, []);
  const sessionEnded = useCallback(() => {
    setSession(null);
    setUserId(null);
  }, []);
  const openUser = useCallback((uid: string) => setUserId(uid), []);
  const contextValue = useMemo(() => ({ reportUsage, sessionEnded, openUser }), [reportUsage, sessionEnded, openUser]);

  const lock = async () => {
    try {
      await consoleFetch('/api/console/session', { method: 'DELETE' });
    } finally {
      sessionEnded();
    }
  };

  if (checking) {
    return <div className="app-shell min-h-screen bg-background"><Spinner label="Checking console session" /></div>;
  }

  if (!session) {
    return (
      <div className="app-shell flex min-h-screen items-center bg-background px-4 py-10">
        <UnlockPanel onUnlocked={(next) => setSession(next)} />
      </div>
    );
  }

  return (
    <ConsoleContext.Provider value={contextValue}>
      <div className="app-shell min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <SerenityMark className="h-7 w-7 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-display text-base font-bold leading-tight">Serenity console</p>
                <p className="truncate text-[11px] text-muted-foreground">{session.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {usage && <div className="hidden sm:block"><UsageMeter usage={usage} /></div>}
              <ThemeToggle />
              <button type="button" onClick={lock} className="btn-outline min-h-10 px-3">
                <Lock className="h-4 w-4" aria-hidden="true" />
                Lock
              </button>
            </div>
          </div>
          <nav className="mx-auto max-w-7xl overflow-x-auto px-2 sm:px-4" aria-label="Console sections">
            <ul className="flex min-w-max gap-1 pb-2">
              {TABS.map((entry) => {
                const Icon = entry.icon;
                const selected = tab === entry.id;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => setTab(entry.id)}
                      aria-current={selected ? 'page' : undefined}
                      className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                        selected ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {entry.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {usage && <div className="mb-5 sm:hidden"><UsageMeter usage={usage} /></div>}
          {tab === 'overview' && <OverviewTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'certificates' && <CertificatesTab />}
          {tab === 'batches' && <BatchesTab />}
          {tab === 'emails' && <EmailsTab />}
          {tab === 'leads' && <LeadsTab />}
          {tab === 'audit' && <AuditTab />}
        </main>

        {userId && <UserDrawer uid={userId} onClose={() => setUserId(null)} />}
      </div>
    </ConsoleContext.Provider>
  );
}
