'use client';

import type { ConsoleUsage } from './api';
import { useConsole, useConsoleResource } from './context';
import { formatDateTime } from './format';
import { Empty, Notice, Spinner } from './ui';

interface AuditResponse {
  entries: Array<{ id: string; at: string | null; action: string | null; actorEmail: string | null; target: string | null; details: Record<string, unknown> }>;
  usage?: ConsoleUsage | null;
}

const ACTION_LABELS: Record<string, string> = {
  'console.unlocked': 'Console unlocked',
  'console.unlock_failed': 'Failed unlock attempt',
  'console.locked': 'Console locked',
  'console.passphrase_set': 'Passphrase set or rotated',
  'premium.granted': 'Pro granted',
  'premium.revoked': 'Pro removed',
};

function describeDetails(action: string | null, details: Record<string, unknown>): string | null {
  if (action === 'premium.granted' || action === 'premium.revoked') {
    const after = details.after as { until?: string | null } | undefined;
    const parts: string[] = [];
    if (action === 'premium.granted') parts.push(after?.until ? `until ${formatDateTime(after.until)}` : 'no end date');
    if (typeof details.note === 'string' && details.note) parts.push(`note: ${details.note}`);
    return parts.join(' · ') || null;
  }
  if (action === 'console.unlock_failed' && details.locked) return 'unlocking was paused after repeated failures';
  return null;
}

export function AuditTab() {
  const { openUser } = useConsole();
  const { data, error } = useConsoleResource<AuditResponse>('/api/console/audit');

  if (!data) return error ? <Notice>{error.message}</Notice> : <Spinner />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Audit log</h1>
        <p className="text-sm text-muted-foreground">The 50 most recent console events. Entries cannot be edited from the console.</p>
      </div>
      {data.entries.length === 0 ? (
        <Empty>No console activity has been recorded.</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {data.entries.map((entry) => {
            const detail = describeDetails(entry.action, entry.details);
            return (
              <li key={entry.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                <span className="min-w-0">
                  <span className="block font-medium">{ACTION_LABELS[entry.action || ''] || entry.action}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    by {entry.actorEmail || 'unknown'}
                    {entry.target && (
                      <>
                        {' · '}
                        <button type="button" onClick={() => openUser(entry.target as string)} className="hover:text-primary">
                          account {entry.target}
                        </button>
                      </>
                    )}
                    {detail ? ` · ${detail}` : ''}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
