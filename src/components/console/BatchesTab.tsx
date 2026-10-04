'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import type { ConsoleBatch, ConsoleCertificate } from '@/lib/admin/analytics';
import { ConsoleRequestError, consoleFetch, type ConsoleUsage } from './api';
import { useConsole } from './context';
import { usePaged } from './usePaged';
import { formatDateTime, formatDay, formatExact } from './format';
import { DeliveryBadge } from './CertificatesTab';
import { Drawer, Empty, LoadMore, Notice, Spinner } from './ui';

interface BatchesResponse {
  batches: ConsoleBatch[];
  nextCursor: string | null;
  usage?: ConsoleUsage | null;
}

interface RecipientsResponse {
  batch: ConsoleBatch | null;
  certificates: ConsoleCertificate[];
  truncated: boolean;
  usage?: ConsoleUsage | null;
}

function RecipientsDrawer({ batch, onClose }: { batch: ConsoleBatch; onClose: () => void }) {
  const { reportUsage, sessionEnded, openUser } = useConsole();
  const [data, setData] = useState<RecipientsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    consoleFetch<RecipientsResponse>(`/api/console/batches/${encodeURIComponent(batch.id)}`)
      .then((body) => {
        if (cancelled) return;
        setData(body);
        reportUsage(body.usage);
      })
      .catch((caught) => {
        if (cancelled) return;
        if (caught instanceof ConsoleRequestError && caught.status === 404 && !caught.code) sessionEnded();
        else setError(caught instanceof Error ? caught.message : 'Could not load recipients.');
      });
    return () => {
      cancelled = true;
    };
  }, [batch.id, reportUsage, sessionEnded]);

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const certificates = data?.certificates ?? [];
    if (!needle) return certificates;
    return certificates.filter((certificate) =>
      `${certificate.recipientName || ''} ${certificate.recipientEmail || ''}`.toLowerCase().includes(needle));
  }, [data, filter]);

  const sent = data?.certificates.filter((certificate) => certificate.email.status === 'sent').length ?? 0;
  const failed = data?.certificates.filter((certificate) => certificate.email.status === 'failed').length ?? 0;

  return (
    <Drawer title={batch.title || 'Batch'} onClose={onClose}>
      <div className="space-y-5">
        <div className="text-sm text-muted-foreground">
          <p>{batch.issuerName || 'Issuer'} · {batch.templateName || 'Template'} · {formatDateTime(batch.createdAt)}</p>
          {batch.ownerUid && (
            <button type="button" onClick={() => openUser(batch.ownerUid as string)} className="mt-1 font-medium text-primary hover:underline">
              Issued by {batch.ownerEmail || batch.ownerUid}
            </button>
          )}
        </div>

        {error && <Notice>{error}</Notice>}
        {!data && !error && <Spinner />}

        {data && (
          <>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">Certificates</dt><dd className="font-semibold">{formatExact(data.certificates.length)}</dd></div>
              <div className="rounded-xl bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">Emailed</dt><dd className="font-semibold">{formatExact(sent)}</dd></div>
              <div className="rounded-xl bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">Failed</dt><dd className="font-semibold">{formatExact(failed)}</dd></div>
            </dl>
            {data.truncated && <Notice tone="warning">Showing the first 500 recipients of this batch.</Notice>}

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter recipients" aria-label="Filter recipients" className="input pl-9" />
            </div>

            <ul className="divide-y divide-border rounded-xl border border-border">
              {rows.map((certificate) => (
                <li key={certificate.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{certificate.recipientName || 'Recipient'}</span>
                    <span className="block truncate text-xs text-muted-foreground">{certificate.recipientEmail || 'No email in the data'}</span>
                    {certificate.email.error && <span className="block truncate text-xs text-error">{certificate.email.error}</span>}
                  </span>
                  <DeliveryBadge status={certificate.email.status} />
                  <span className="text-xs tabular-nums text-muted-foreground">{formatExact(certificate.views)} views</span>
                  <a href={`/verify/${certificate.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary hover:bg-primary/10">
                    Verify <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </li>
              ))}
              {rows.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No recipients match.</li>}
            </ul>
          </>
        )}
      </div>
    </Drawer>
  );
}

export function BatchesTab() {
  const [selected, setSelected] = useState<ConsoleBatch | null>(null);
  const { items, loading, error, hasMore, loadMore, reload } = usePaged<ConsoleBatch, BatchesResponse>(
    '/api/console/batches',
    (body) => body.batches,
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Batches</h1>
        <p className="text-sm text-muted-foreground">
          Each generation run, who ran it, and who received the certificates. Batches are tracked from this release onward;
          older certificates appear in the Certificates tab.
        </p>
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
        <Empty>No tracked batches yet.</Empty>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((batch) => (
            <li key={batch.id}>
              <button
                type="button"
                onClick={() => setSelected(batch)}
                className="flex w-full gap-4 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40"
              >
                <div className="aspect-[1.414/1] w-28 shrink-0 overflow-hidden rounded-lg bg-muted sm:w-36">
                  {batch.sampleImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={batch.sampleImage} alt="" loading="lazy" className="h-full w-full object-contain" />
                  )}
                </div>
                <div className="min-w-0 flex-1 py-1">
                  <p className="truncate font-semibold">{batch.title || 'Untitled batch'}</p>
                  <p className="truncate text-xs text-muted-foreground">{batch.issuerName || 'Issuer'} · {formatDay(batch.createdAt)}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{batch.ownerEmail || batch.ownerUid}</p>
                  <p className="mt-2 text-sm">
                    <span className="font-semibold tabular-nums">{formatExact(batch.certificateCount)}</span> issued ·{' '}
                    <span className="tabular-nums">{formatExact(batch.recipientsWithEmail)}</span> with email
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasMore && <LoadMore onClick={loadMore} loading={loading} />}
      {selected && <RecipientsDrawer batch={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
