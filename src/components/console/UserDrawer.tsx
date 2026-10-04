'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Crown, Loader2, ShieldOff } from 'lucide-react';
import type { ConsoleBatch, ConsoleCertificate, ConsoleUser } from '@/lib/admin/analytics';
import { ConsoleRequestError, consoleFetch, type ConsoleUsage } from './api';
import { useConsole } from './context';
import { formatDateTime, formatDay, formatExact, formatRelative, providerLabel } from './format';
import { Badge, Drawer, Notice, Spinner } from './ui';
import { PlanBadge } from './UsersTab';

interface UserDetailResponse {
  detail: {
    user: ConsoleUser;
    certificateCount: number;
    certificates: ConsoleCertificate[];
    batches: ConsoleBatch[];
    templates: Array<{ id: string; name: string | null; isPublic: boolean; updatedAt: string | null; thumbnail: string | null; certificateCount: number }>;
  };
  usage?: ConsoleUsage | null;
}

const PRESETS = [
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '1 year', months: 12 },
  { label: 'No end date', months: 0 },
];

function monthsFromNow(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function PremiumControls({ user, onChanged }: { user: ConsoleUser; onChanged: () => void }) {
  const { reportUsage } = useConsole();
  const [action, setAction] = useState<'grant' | 'revoke'>(user.premium.active ? 'revoke' : 'grant');
  const [until, setUntil] = useState<string>(monthsFromNow(1));
  const [noEnd, setNoEnd] = useState(false);
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const label = user.email || user.name || user.uid;
  // The chosen date means "through the end of that day" in the operator's time zone.
  const untilDate = noEnd || !until ? null : new Date(`${until}T23:59:59`);
  const untilIso = untilDate && !Number.isNaN(untilDate.getTime()) ? untilDate.toISOString() : null;
  const missingEndDate = action === 'grant' && !noEnd && !untilIso;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = await consoleFetch<{ usage?: ConsoleUsage | null }>(`/api/console/users/${encodeURIComponent(user.uid)}/premium`, {
        method: 'POST',
        body: JSON.stringify({ action, until: action === 'grant' ? untilIso : null, note }),
      });
      reportUsage(body.usage);
      setDone(action === 'grant' ? 'Pro granted.' : 'Pro removed.');
      setConfirming(false);
      setNote('');
      onChanged();
    } catch (caught) {
      setError(caught instanceof ConsoleRequestError ? caught.message : 'The change could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Plan</h3>
        <PlanBadge user={user} />
      </div>
      {user.premium.active && (
        <p className="text-xs text-muted-foreground">
          {user.premium.source === 'console' ? 'Granted from this console' : 'Granted outside this console'}
          {user.premium.grantedBy ? ` by ${user.premium.grantedBy}` : ''}.
          {user.premium.note ? ` Note: ${user.premium.note}` : ''}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Plan change">
        {(['grant', 'revoke'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={action === option}
            onClick={() => { setAction(option); setConfirming(false); setDone(null); }}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium ${
              action === option ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
            }`}
          >
            {option === 'grant' ? <Crown className="h-4 w-4" aria-hidden="true" /> : <ShieldOff className="h-4 w-4" aria-hidden="true" />}
            {option === 'grant' ? (user.premium.active ? 'Change Pro' : 'Grant Pro') : 'Remove Pro'}
          </button>
        ))}
      </div>

      {action === 'grant' && (
        <fieldset className="space-y-2">
          <legend className="label">Pro ends</legend>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setConfirming(false);
                  if (preset.months === 0) setNoEnd(true);
                  else { setNoEnd(false); setUntil(monthsFromNow(preset.months)); }
                }}
                className="min-h-9 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted"
              >
                {preset.label}
              </button>
            ))}
          </div>
          {noEnd ? (
            <p className="text-sm text-muted-foreground">No end date: Pro stays active until removed.</p>
          ) : (
            <input
              type="date"
              value={until}
              min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
              onChange={(event) => { setUntil(event.target.value); setConfirming(false); }}
              className="input"
              aria-label="Pro end date"
              required
            />
          )}
        </fieldset>
      )}

      <div>
        <label htmlFor="premium-note" className="label">Note for the audit log (optional)</label>
        <textarea
          id="premium-note"
          value={note}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
          className="input mt-2 h-20 resize-none py-2"
          placeholder="For example: paid invoice #1042, $20/month"
        />
      </div>

      {confirming && (
        <Notice tone="warning">
          {action === 'grant'
            ? `Grant Pro to ${label}${noEnd ? ' with no end date' : ` until ${formatDay(untilIso)}`}? Select confirm to apply.`
            : `Remove Pro from ${label}? They return to the free allowance immediately.`}
        </Notice>
      )}
      {error && <Notice>{error}</Notice>}
      {done && <p role="status" className="text-sm font-medium text-success">{done}</p>}

      <div className="flex gap-2">
        {confirming && (
          <button type="button" onClick={() => setConfirming(false)} className="btn-outline flex-1" disabled={busy}>Cancel</button>
        )}
        <button type="submit" className={`${action === 'revoke' && confirming ? 'btn bg-error text-white hover:bg-error/90' : 'btn-primary'} flex-1`} disabled={busy || missingEndDate || (action === 'revoke' && !user.premium.active && !user.premium.expired)}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {confirming ? 'Confirm' : action === 'grant' ? 'Review grant' : 'Review removal'}
        </button>
      </div>
    </form>
  );
}

export function UserDrawer({ uid, onClose }: { uid: string; onClose: () => void }) {
  const { reportUsage, sessionEnded } = useConsole();
  const [data, setData] = useState<UserDetailResponse['detail'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const body = await consoleFetch<UserDetailResponse>(`/api/console/users/${encodeURIComponent(uid)}`);
      setData(body.detail);
      reportUsage(body.usage);
    } catch (caught) {
      if (caught instanceof ConsoleRequestError && caught.status === 404 && !caught.code) {
        sessionEnded();
        return;
      }
      setError(caught instanceof Error ? caught.message : 'Could not load this account.');
    }
  }, [uid, reportUsage, sessionEnded]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const user = data?.user;

  return (
    <Drawer title={user ? (user.name || user.email || 'Account') : 'Account'} onClose={onClose}>
      {error && <Notice>{error}</Notice>}
      {!data && !error && <Spinner />}
      {user && data && (
        <div className="space-y-6">
          <section className="space-y-1 text-sm">
            <p className="break-all font-medium">{user.email || 'No email'}</p>
            <p className="break-all text-xs text-muted-foreground">User ID {user.uid}</p>
            <div className="flex flex-wrap gap-1.5 pt-2">
              {user.emailVerified ? <Badge tone="success">Email verified</Badge> : <Badge tone="warning">Email not verified</Badge>}
              {user.providers.map((provider) => <Badge key={provider} tone="neutral">{providerLabel(provider)}</Badge>)}
              {!user.hasProfile && <Badge tone="warning">No profile document</Badge>}
              {user.disabled && <Badge tone="error">Disabled</Badge>}
              {user.deleted && <Badge tone="error">Marked deleted</Badge>}
            </div>
          </section>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Joined', formatDateTime(user.createdAt)],
              ['Last sign-in', formatDateTime(user.lastSignInAt)],
              ['Last active', formatRelative(user.lastActiveAt)],
              ['Last generation', formatRelative(user.lastGeneratedAt)],
              ['Certificates stored', formatExact(data.certificateCount)],
              ['Usage counter', formatExact(user.certificatesGenerated)],
            ].map(([term, value]) => (
              <div key={term} className="rounded-xl bg-muted/50 p-3">
                <dt className="text-xs text-muted-foreground">{term}</dt>
                <dd className="mt-0.5 font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          <PremiumControls user={user} onChanged={() => void load()} />

          <section>
            <h3 className="mb-3 font-semibold">Recent certificates</h3>
            {data.certificates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No certificates yet.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.certificates.map((certificate) => (
                  <li key={certificate.id} className="overflow-hidden rounded-xl border border-border bg-card">
                    <a href={`/verify/${certificate.id}`} target="_blank" rel="noopener noreferrer" className="block">
                      <div className="aspect-[1.414/1] bg-muted">
                        {certificate.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={certificate.image} alt="" loading="lazy" className="h-full w-full object-contain" />
                        )}
                      </div>
                      <div className="p-2">
                        <p className="truncate text-xs font-medium">{certificate.recipientName || 'Recipient'}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{certificate.recipientEmail || 'No email'}</p>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.batches.length > 0 && (
            <section>
              <h3 className="mb-3 font-semibold">Batches</h3>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {data.batches.map((batch) => (
                  <li key={batch.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{batch.title || 'Untitled batch'}</span>
                      <span className="block truncate text-xs text-muted-foreground">{batch.templateName || 'Template'} · {formatDay(batch.createdAt)}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatExact(batch.certificateCount)} issued</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-3 font-semibold">Templates</h3>
            {data.templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved templates.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.templates.map((template) => (
                  <li key={template.id} className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="aspect-[1.414/1] bg-muted">
                      {template.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={template.thumbnail} alt="" loading="lazy" className="h-full w-full object-contain" />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 p-2">
                      <p className="min-w-0 truncate text-xs font-medium">{template.name || 'Untitled'}</p>
                      {template.isPublic && <Badge tone="success">Public</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}
