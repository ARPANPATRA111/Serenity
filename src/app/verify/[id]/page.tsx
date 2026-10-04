import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { Award, Building, Calendar, CheckCircle, ExternalLink, Eye, Images, MapPin, ShieldX } from 'lucide-react';
import { normalizeCertificateId } from '@/lib/verification/certificateId';
import { clientFromHeaders, getVerification } from '@/lib/verification/service';
import type { PublicCertificate } from '@/lib/verification/lookup';
import { formatDate } from '@/lib/utils';
import { VerifyShell } from './VerifyShell';
import { LocalDate } from './LocalDate';
import { ViewBeacon } from './ViewBeacon';
import { CopyCertificateId, VerificationActions } from './VerificationActions';

export const dynamic = 'force-dynamic';

interface VerifyPageProps {
  params: { id: string };
}

/**
 * Thrown when the lookup could not reach a definitive answer. The segment's
 * error boundary renders a retrying "temporarily unavailable" state and the
 * response is not a 200, so link-preview crawlers do not cache it.
 */
class VerificationUnavailableError extends Error {
  constructor(reason: string) {
    super(`Certificate verification is temporarily unavailable (${reason})`);
    this.name = 'VerificationUnavailableError';
  }
}

const resolveVerification = cache(async (rawId: string) => {
  const id = normalizeCertificateId(rawId);
  if (!id) return { id: null, result: { status: 'invalid_id' as const } };
  const result = await getVerification(id, { client: clientFromHeaders(headers()) });
  return { id, result };
});

/**
 * Status-code decisions (404, redirect, unavailable) are made here rather than
 * in the page: metadata resolves before the response starts streaming, while
 * the page renders inside the root loading boundary where the status is
 * already fixed at 200. Crawlers, link previewers and QR scanner apps then see
 * real 404/307/500 responses. Page and metadata share one cached lookup.
 */
export async function generateMetadata({ params }: VerifyPageProps): Promise<Metadata> {
  const { id, result } = await resolveVerification(params.id);
  if (!id) notFound();
  if (id !== params.id) redirect(`/verify/${id}`);
  if (result.status === 'not_found' || result.status === 'invalid_id') notFound();
  if (result.status === 'unavailable') throw new VerificationUnavailableError(result.reason);

  // Per-recipient pages stay out of search indexes but remain followable.
  const robots = { index: false, follow: true };

  if (result.status === 'valid') {
    const { certificate } = result;
    const title = `${certificate.title} — ${certificate.recipientName}`;
    const description = `Issued by ${certificate.issuerName} on ${formatDate(certificate.issuedAt, { timeZone: 'UTC' })}. Verified with Serenity.`;
    const images = certificate.certificateImage ? [{ url: certificate.certificateImage }] : undefined;
    return {
      title,
      description,
      robots,
      openGraph: { title, description, type: 'article', ...(images ? { images } : {}) },
      twitter: { card: images ? 'summary_large_image' : 'summary', title, description, ...(images ? { images } : {}) },
    };
  }

  if (result.status === 'revoked') {
    return { title: 'Certificate revoked', robots };
  }

  return {
    title: 'Verify certificate',
    description: 'Verify the authenticity of a certificate issued with Serenity.',
    robots,
  };
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { id, result } = await resolveVerification(params.id);

  if (!id) notFound();
  // Repair links damaged in transit (trailing punctuation, encoded
  // characters, zero-width spaces) by redirecting to the canonical address.
  if (id !== params.id) redirect(`/verify/${id}`);

  switch (result.status) {
    case 'valid':
      return <ValidCertificate certificate={result.certificate} />;
    case 'revoked':
      return <RevokedCertificate certificateId={id} />;
    case 'unavailable':
      throw new VerificationUnavailableError(result.reason);
    case 'not_found':
    case 'invalid_id':
    default:
      notFound();
  }
}

function RevokedCertificate({ certificateId }: { certificateId: string }) {
  return (
    <VerifyShell>
      <section className="mx-auto max-w-xl text-center" aria-labelledby="revoked-heading">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-error/15">
          <ShieldX className="h-10 w-10 text-error" aria-hidden="true" />
        </div>
        <h1 id="revoked-heading" className="font-display text-3xl font-bold">Certificate revoked</h1>
        <p className="mt-4 text-muted-foreground">
          This certificate was issued with Serenity but has since been revoked by its issuer, so it is no longer valid.
          Contact the issuing organisation if you believe this is a mistake.
        </p>
        <p className="mt-6 break-all text-sm text-muted-foreground">
          Certificate ID: <code className="rounded bg-muted px-2 py-1">{certificateId}</code>
        </p>
      </section>
    </VerifyShell>
  );
}

function ValidCertificate({ certificate }: { certificate: PublicCertificate }) {
  const { event } = certificate;
  const venue = event ? [event.venueName, event.city, event.country].filter(Boolean).join(', ') : '';

  return (
    <VerifyShell>
      <ViewBeacon certificateId={certificate.id} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
        <div>
          {certificate.certificateImage ? (
            <figure className="overflow-hidden rounded-xl border border-border bg-card shadow-lg lg:sticky lg:top-24">
              <div className="relative aspect-[1.414/1] w-full bg-muted">
                {/* Served straight from object storage: verification must not
                    depend on the image optimiser or its quota. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={certificate.certificateImage}
                  alt={`Certificate awarded to ${certificate.recipientName}`}
                  className="h-full w-full object-contain"
                  width={1684}
                  height={1190}
                  decoding="async"
                  loading="eager"
                />
              </div>
              <figcaption className="flex items-center justify-between gap-3 border-t border-border bg-card p-3">
                <span className="text-xs text-muted-foreground">Certificate preview</span>
                <a
                  href={certificate.certificateImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Open full size
                </a>
              </figcaption>
            </figure>
          ) : (
            <div className="flex aspect-[1.414/1] items-center justify-center rounded-xl border border-border bg-muted">
              <div className="text-center text-muted-foreground">
                <Award className="mx-auto mb-2 h-12 w-12 opacity-50" aria-hidden="true" />
                <p className="text-sm">Certificate preview unavailable</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-success" data-testid="verification-status">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success/20">
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
            </span>
            Verified certificate
          </p>

          <h1 className="mb-2 break-words font-display text-2xl font-bold sm:text-3xl lg:text-4xl">{certificate.title}</h1>
          <p className="mb-4 break-words text-base text-muted-foreground sm:text-lg">
            Issued by <span className="font-semibold text-foreground">{certificate.issuerName}</span>
          </p>

          <div className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-lg font-bold text-white sm:h-14 sm:w-14 sm:text-xl" aria-hidden="true">
                {certificate.recipientName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Awarded to</p>
                <h2 className="break-words font-display text-lg font-bold sm:text-xl" data-testid="recipient-name">
                  {certificate.recipientName}
                </h2>
              </div>
            </div>
          </div>

          {certificate.description && (
            <p className="mb-6 break-words text-sm leading-6 text-muted-foreground">{certificate.description}</p>
          )}

          <dl className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-3 sm:p-4">
              <dt className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                Issued on
              </dt>
              <dd className="text-sm font-medium sm:text-base">
                <LocalDate value={certificate.issuedAt} />
              </dd>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 sm:p-4">
              <dt className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Eye className="h-4 w-4" aria-hidden="true" />
                Verified
              </dt>
              <dd className="text-sm font-medium sm:text-base">
                {certificate.viewCount} time{certificate.viewCount === 1 ? '' : 's'}
              </dd>
            </div>
          </dl>

          {event && (
            <section className="mb-6 overflow-hidden rounded-2xl border border-primary/20 bg-primary/5" aria-label="Linked event">
              {event.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={event.coverImageUrl} alt="" className="h-32 w-full object-cover" />
              )}
              <div className="p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Linked event · {event.type}</p>
                <h2 className="mt-2 break-words font-display text-xl font-bold">{event.name}</h2>
                {event.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.description}</p>}
                <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                  {event.startAt && (
                    <p className="flex gap-2"><Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><LocalDate value={event.startAt} /></p>
                  )}
                  {venue && <p className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />{venue}</p>}
                  {event.organizerName && (
                    <p className="flex gap-2"><Building className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />Organized by {event.organizerName}</p>
                  )}
                  {event.galleryImageUrls.length > 0 && (
                    <p className="flex gap-2">
                      <Images className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      {event.galleryImageUrls.length} event image{event.galleryImageUrls.length === 1 ? '' : 's'} available
                    </p>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    ...(event.websiteUrl ? [{ label: 'Event website', url: event.websiteUrl }] : []),
                    ...(event.registrationUrl ? [{ label: 'Registration', url: event.registrationUrl }] : []),
                    ...event.links,
                  ].map((link) => (
                    <a
                      key={`${link.label}-${link.url}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:border-primary/40"
                    >
                      {link.label}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>
            </section>
          )}

          <div className="mb-6 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="mb-0.5 text-xs text-muted-foreground">Certificate ID</p>
                <code className="block break-all font-mono text-xs sm:text-sm" data-testid="certificate-id">{certificate.id}</code>
              </div>
              <CopyCertificateId certificateId={certificate.id} />
            </div>
          </div>

          <VerificationActions
            certificateId={certificate.id}
            title={certificate.title}
            issuerName={certificate.issuerName}
            issuedAt={certificate.issuedAt}
          />
        </div>
      </div>

      <div className="mt-8 rounded-lg bg-success/10 p-4 text-center text-sm text-success">
        <CheckCircle className="mx-auto mb-2 h-5 w-5" aria-hidden="true" />
        This certificate matches a record issued through Serenity.
        <br className="hidden sm:block" />
        <span className="sm:ml-1">The verification link and QR code on the certificate both lead to this page.</span>
      </div>
    </VerifyShell>
  );
}
