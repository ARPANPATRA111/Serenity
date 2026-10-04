'use client';

import { Eye, ExternalLink } from 'lucide-react';
import type { ConsoleCertificate } from '@/lib/admin/analytics';
import type { ConsoleUsage } from './api';
import { useConsole } from './context';
import { usePaged } from './usePaged';
import { formatDay, formatExact } from './format';
import { Badge, Empty, LoadMore, Notice, Spinner } from './ui';

interface CertificatesResponse {
  certificates: ConsoleCertificate[];
  nextCursor: string | null;
  usage?: ConsoleUsage | null;
}

export function DeliveryBadge({ status }: { status: string }) {
  if (status === 'sent') return <Badge tone="success">Emailed</Badge>;
  if (status === 'failed') return <Badge tone="error">Email failed</Badge>;
  return <Badge tone="neutral">Not emailed</Badge>;
}

export function CertificatesTab() {
  const { openUser } = useConsole();
  const { items, loading, error, hasMore, loadMore, reload } = usePaged<ConsoleCertificate, CertificatesResponse>(
    '/api/console/certificates',
    (body) => body.certificates,
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Certificates</h1>
        <p className="text-sm text-muted-foreground">Newest first, with the image each recipient received.</p>
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
        <Empty>No certificates have been issued yet.</Empty>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((certificate) => (
            <li key={certificate.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
              <div className="aspect-[1.414/1] bg-muted">
                {certificate.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={certificate.image} alt={`Certificate for ${certificate.recipientName || 'recipient'}`} loading="lazy" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No preview stored</div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{certificate.recipientName || 'Recipient'}</p>
                    <p className="truncate text-xs text-muted-foreground">{certificate.recipientEmail || 'No recipient email'}</p>
                  </div>
                  {!certificate.active && <Badge tone="error">Revoked</Badge>}
                </div>
                <p className="truncate text-sm">{certificate.title || 'Certificate'}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {certificate.issuerName || 'Issuer'} · {certificate.templateName || 'Template'} · {formatDay(certificate.createdAt)}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                  <DeliveryBadge status={certificate.email.status} />
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {formatExact(certificate.views)}
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    {certificate.ownerUid && (
                      <button type="button" onClick={() => openUser(certificate.ownerUid as string)} className="min-h-9 rounded-md px-2 text-xs font-medium text-primary hover:bg-primary/10">
                        Issuer
                      </button>
                    )}
                    <a
                      href={`/verify/${certificate.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      Verify <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && <LoadMore onClick={loadMore} loading={loading} />}
    </div>
  );
}
