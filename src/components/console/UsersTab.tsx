'use client';

import { FormEvent, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { ConsoleUser, UserSort } from '@/lib/admin/analytics';
import type { ConsoleUsage } from './api';
import { useConsole } from './context';
import { usePaged } from './usePaged';
import { formatDay, formatExact, formatRelative, providerLabel } from './format';
import { Badge, Empty, LoadMore, Notice, Spinner } from './ui';

interface UsersResponse {
  users: ConsoleUser[];
  nextCursor: string | null;
  total: number | null;
  usage?: ConsoleUsage | null;
}

const SORTS: Array<{ id: UserSort; label: string }> = [
  { id: 'newest', label: 'Newest' },
  { id: 'active', label: 'Recently active' },
  { id: 'creators', label: 'Top issuers' },
  { id: 'premium', label: 'Pro accounts' },
];

export function PlanBadge({ user }: { user: ConsoleUser }) {
  if (user.premium.active) {
    return <Badge tone="primary">{user.premium.until ? `Pro until ${formatDay(user.premium.until)}` : 'Pro'}</Badge>;
  }
  if (user.premium.expired) return <Badge tone="warning">Pro expired</Badge>;
  return <Badge tone="neutral">Free</Badge>;
}

export function UsersTab() {
  const { openUser } = useConsole();
  const [sort, setSort] = useState<UserSort>('newest');
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');

  const path = `/api/console/users?sort=${sort}${query ? `&q=${encodeURIComponent(query)}` : ''}`;
  const { items, loading, error, hasMore, loadMore, lastBody, reload } = usePaged<ConsoleUser, UsersResponse>(path, (body) => body.users);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setQuery(draft.trim());
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">
            {lastBody?.total !== null && lastBody?.total !== undefined ? `${formatExact(lastBody.total)} accounts` : 'Accounts and plans'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={submit} className="relative flex-1" role="search">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search by email, name, or user ID"
            aria-label="Search users"
            className="input pl-9 pr-10"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setDraft(''); setQuery(''); }}
              className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg hover:bg-muted"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </form>
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1" role="group" aria-label="Sort users">
          {SORTS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => { setSort(option.id); setQuery(''); setDraft(''); }}
              aria-pressed={sort === option.id && !query}
              className={`min-h-9 whitespace-nowrap rounded-lg px-3 text-sm font-medium ${
                sort === option.id && !query ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
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
        <Empty>{query ? 'No accounts match that search.' : 'No accounts yet.'}</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {items.map((user) => (
            <li key={user.uid}>
              <button
                type="button"
                onClick={() => openUser(user.uid)}
                className="grid w-full gap-2 px-4 py-3 text-left hover:bg-muted/50 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center md:gap-4"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary" aria-hidden="true">
                    {(user.name || user.email || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{user.name || 'Unnamed account'}</span>
                    <span className="block truncate text-xs text-muted-foreground">{user.email || user.uid}</span>
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  Joined {formatDay(user.createdAt)}
                  <span className="block">Active {formatRelative(user.lastActiveAt)}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">{formatExact(user.certificatesGenerated)}</span> certificates
                  <span className="block">{user.providers.map(providerLabel).join(', ') || 'No provider data'}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5 md:justify-end">
                  <PlanBadge user={user} />
                  {!user.emailVerified && <Badge tone="warning">Unverified</Badge>}
                  {user.disabled && <Badge tone="error">Disabled</Badge>}
                  {user.deleted && <Badge tone="error">Deleted</Badge>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasMore && <LoadMore onClick={loadMore} loading={loading} />}
    </div>
  );
}
