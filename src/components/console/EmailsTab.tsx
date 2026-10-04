'use client';

import { Paperclip } from 'lucide-react';
import type { ConsoleUsage } from './api';
import { useConsole } from './context';
import { usePaged } from './usePaged';
import { formatDateTime } from './format';
import { Empty, LoadMore, Notice, Spinner } from './ui';

interface EmailEntry {
  id: string;
  to: string | null;
  certificateId: string | null;
  senderUid: string | null;
  senderEmail: string | null;
  sentAt: string | null;
  hadAttachment: boolean;
}

interface EmailsResponse {
  emails: EmailEntry[];
  nextCursor: string | null;
  usage?: ConsoleUsage | null;
}

export function EmailsTab() {
  const { openUser } = useConsole();
  const { items, loading, error, hasMore, loadMore, reload } = usePaged<EmailEntry, EmailsResponse>(
    '/api/console/emails',
    (body) => body.emails,
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Deliveries</h1>
        <p className="text-sm text-muted-foreground">Every certificate email the provider accepted, newest first.</p>
      </div>

      {error && (
        <div className="space-y-2">
          <Notice>{error.message}</Notice>
          {error.code === 'READ_BUDGET_EXCEEDED' && <button type="button" className="btn-outline" onClick={() => reload({ force: true })}>Load anyway</button>}
        </div>
      )}

      {items.length === 0 && loading ? (
        <Spinner />
      ) : items.length === 0 && !error ? (
        <Empty>No certificate emails have been sent yet.</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {items.map((entry) => (
            <li key={entry.id} className="grid gap-1 px-4 py-3 text-sm md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center md:gap-4">
              <span className="min-w-0">
                <span className="block truncate font-medium">{entry.to || 'Unknown recipient'}</span>
                {entry.certificateId && (
                  <a href={`/verify/${entry.certificateId}`} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-primary hover:underline">
                    Certificate {entry.certificateId}
                  </a>
                )}
              </span>
              <span className="min-w-0 text-xs text-muted-foreground">
                {entry.senderUid ? (
                  <button type="button" onClick={() => openUser(entry.senderUid as string)} className="truncate text-left hover:text-primary">
                    Sent by {entry.senderEmail || entry.senderUid}
                  </button>
                ) : 'Sender unknown'}
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground md:justify-end">
                {entry.hadAttachment && <Paperclip className="h-3.5 w-3.5" aria-label="Sent with the certificate attached" />}
                {formatDateTime(entry.sentAt)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasMore && <LoadMore onClick={loadMore} loading={loading} />}
    </div>
  );
}
