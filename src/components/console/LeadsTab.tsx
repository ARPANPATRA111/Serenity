'use client';

import { useState } from 'react';
import { UserSearch } from 'lucide-react';
import { consoleFetch, type ConsoleUsage } from './api';
import { useConsole, useConsoleResource } from './context';
import { formatDateTime } from './format';
import { Badge, Empty, Notice, Spinner } from './ui';

interface LeadsResponse {
  leads: Array<{ id: string; email: string | null; userId: string | null; feature: string | null; createdAt: string | null; message: string | null }>;
  waitlist: Array<{ email: string; features: string[]; createdAt: string | null; lastInteraction: string | null }>;
  usage?: ConsoleUsage | null;
}

const FEATURE_LABELS: Record<string, string> = {
  pro_pricing: 'Pro plan request',
  bulk_email: 'Bulk email',
  bulk_download: 'Bulk download',
  custom_branding: 'Custom branding',
  api_access: 'API access',
};

export function LeadsTab() {
  const { openUser, reportUsage } = useConsole();
  const { data, error, loading } = useConsoleResource<LeadsResponse>('/api/console/leads');
  const [lookupError, setLookupError] = useState<string | null>(null);

  /** Finds the account behind a request so a plan can be granted from its detail panel. */
  const findAccount = async (email: string | null, userId: string | null) => {
    setLookupError(null);
    if (userId) {
      openUser(userId);
      return;
    }
    if (!email) return;
    try {
      const body = await consoleFetch<{ users: Array<{ uid: string }>; usage?: ConsoleUsage | null }>(`/api/console/users?q=${encodeURIComponent(email)}`);
      reportUsage(body.usage);
      if (body.users[0]) openUser(body.users[0].uid);
      else setLookupError(`No account uses ${email} yet. They need to sign up before Pro can be granted.`);
    } catch (caught) {
      setLookupError(caught instanceof Error ? caught.message : 'Lookup failed.');
    }
  };

  if (!data) return error ? <Notice>{error.message}</Notice> : <Spinner />;

  return (
    <div className={`space-y-8 ${loading ? 'opacity-60' : ''}`}>
      <section className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Pro requests</h1>
          <p className="text-sm text-muted-foreground">Requests from the pricing section and upgrade prompts, newest first.</p>
        </div>
        {lookupError && <Notice tone="warning">{lookupError}</Notice>}
        {data.leads.length === 0 ? (
          <Empty>No requests yet.</Empty>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {data.leads.map((lead) => (
              <li key={lead.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{lead.email || 'No email given'}</span>
                    <Badge tone="primary">{FEATURE_LABELS[lead.feature || ''] || lead.feature || 'Request'}</Badge>
                  </div>
                  {lead.message && <p className="whitespace-pre-wrap break-words text-muted-foreground">{lead.message}</p>}
                  <p className="text-xs text-muted-foreground">{formatDateTime(lead.createdAt)}</p>
                </div>
                {(lead.email || lead.userId) && (
                  <button type="button" onClick={() => findAccount(lead.email, lead.userId)} className="btn-outline min-h-10 shrink-0 self-start">
                    <UserSearch className="h-4 w-4" aria-hidden="true" />
                    Open account
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold">Waitlist</h2>
          <p className="text-sm text-muted-foreground">Unique emails and the features they asked about.</p>
        </div>
        {data.waitlist.length === 0 ? (
          <Empty>The waitlist is empty.</Empty>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {data.waitlist.map((entry) => (
              <li key={entry.email} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0 truncate font-medium">{entry.email}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {entry.features.map((feature) => <Badge key={feature} tone="neutral">{FEATURE_LABELS[feature] || feature}</Badge>)}
                  <span className="text-xs text-muted-foreground">{formatDateTime(entry.lastInteraction || entry.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
