'use client';

import { RefreshCw } from 'lucide-react';
import type { OverviewData } from '@/lib/admin/analytics';
import type { ConsoleUsage } from './api';
import { useConsole, useConsoleResource } from './context';
import { DailyColumns } from './DailyColumns';
import { formatCount, formatExact, formatRelative, providerLabel } from './format';
import { Badge, Notice, Spinner, StatTile } from './ui';
import styles from './console.module.css';

interface OverviewResponse {
  overview: OverviewData;
  cached: boolean;
  usage?: ConsoleUsage | null;
}

export function OverviewTab() {
  const { openUser } = useConsole();
  const { data, error, loading, reload } = useConsoleResource<OverviewResponse>('/api/console/overview');
  const overview = data?.overview;

  if (!overview) {
    if (error) {
      return (
        <div className="space-y-3">
          <Notice>{error.message}</Notice>
          {error.code === 'READ_BUDGET_EXCEEDED' && (
            <button type="button" className="btn-outline" onClick={() => reload({ force: true })}>Load anyway</button>
          )}
        </div>
      );
    }
    return <Spinner label="Loading overview" />;
  }

  const t = overview.totals;
  const maxProvider = Math.max(1, ...overview.providers.map((entry) => entry.accounts));

  return (
    <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Updated {formatRelative(overview.generatedAt)}{data?.cached ? ' (cached)' : ''} · cost about {formatExact(overview.estimatedReads)} reads to compute
          </p>
        </div>
        <button type="button" onClick={() => reload({ extraQuery: 'refresh=1' })} className="btn-outline min-h-10" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {error && <Notice>{error.message}</Notice>}

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Accounts" value={formatCount(t.accounts)} detail={`+${formatExact(t.newAccounts7d)} in 7 days · ${formatExact(t.verifiedAccounts)} verified`} />
        <StatTile label="Active in 7 days" value={formatCount(t.activeAccounts7d)} detail="Signed in or refreshed a session" />
        <StatTile label="Certificates issued" value={formatCount(t.certificates)} detail={`+${formatExact(t.certificates7d)} in 7 days · +${formatExact(t.certificates30d)} in 30`} />
        <StatTile label="Accounts that issued" value={formatCount(t.creators)} detail={`${formatExact(t.batches)} tracked batches`} />
        <StatTile label="Pro accounts" value={formatCount(t.premiumUsers)} detail={`${formatExact(t.leads)} Pro requests received`} />
        <StatTile label="Certificates emailed" value={formatCount(t.emailedCertificates)} detail={`${formatExact(t.failedEmails)} failed · ${formatExact(t.emailSends)} sends logged`} />
        <StatTile label="Verification views" value={formatCount(t.verificationViews)} detail="Unique daily viewers, all certificates" />
        <StatTile label="Templates" value={formatCount(t.templates)} detail={`${formatExact(t.publicTemplates)} public`} />
      </section>

      <section aria-label="Daily activity" className="grid gap-4 lg:grid-cols-2">
        <DailyColumns
          title="Certificates issued per day"
          subtitle="Last 14 days, UTC"
          days={overview.series.days}
          values={overview.series.certificates}
          unit="certificates"
        />
        <DailyColumns
          title="New accounts per day"
          subtitle="Last 14 days, UTC"
          days={overview.series.days}
          values={overview.series.accounts}
          unit="accounts"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={`${styles.viz} rounded-2xl border border-border bg-card p-4 sm:p-5`}>
          <h2 className="font-semibold">Sign-in methods</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Accounts linked to each method</p>
          <ul className="mt-4 space-y-3">
            {overview.providers.map((entry) => (
              <li key={entry.provider}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{providerLabel(entry.provider)}</span>
                  <span className="font-semibold tabular-nums">{formatExact(entry.accounts)}</span>
                </div>
                <div className={`${styles.meterTrack} mt-1.5 h-1.5 rounded-full`} aria-hidden="true">
                  <div className={`${styles.meterFill} h-full rounded-full`} style={{ width: `${(entry.accounts / maxProvider) * 100}%` }} />
                </div>
              </li>
            ))}
            {overview.providers.length === 0 && <li className="text-sm text-muted-foreground">No accounts yet.</li>}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h2 className="font-semibold">Most active issuers</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">By certificates generated</p>
          <ol className="mt-3 divide-y divide-border">
            {overview.topCreators.map((creator) => (
              <li key={creator.uid}>
                <button
                  type="button"
                  onClick={() => openUser(creator.uid)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left hover:text-primary"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{creator.name || creator.email || creator.uid}</span>
                    <span className="block truncate text-xs text-muted-foreground">{creator.email}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {creator.premium && <Badge tone="primary">Pro</Badge>}
                    <span className="text-sm font-semibold tabular-nums">{formatExact(creator.certificatesGenerated)}</span>
                  </span>
                </button>
              </li>
            ))}
            {overview.topCreators.length === 0 && <li className="py-3 text-sm text-muted-foreground">No certificates generated yet.</li>}
          </ol>
        </div>
      </section>
    </div>
  );
}
