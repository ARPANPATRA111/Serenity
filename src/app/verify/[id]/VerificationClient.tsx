'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { CheckCircle, XCircle, Eye, Calendar, Building, Loader2, AlertTriangle, Award, Download, ExternalLink, Mail, User } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface VerificationClientProps {
  certificateId: string;
}

interface CertificateData {
  id: string;
  recipientName: string;
  recipientEmail?: string;
  title: string;
  issuerName: string;
  issuedAt: string;
  viewCount: number;
  isActive: boolean;
  templateId?: string;
  certificateImage?: string;
}

interface VerificationResult {
  isValid: boolean;
  certificate?: CertificateData;
}

export function VerificationClient({ certificateId }: VerificationClientProps) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasCalledApi = useRef(false);

  useEffect(() => {
    async function verifyCertificate() {
      // Prevent double API calls (React StrictMode)
      if (hasCalledApi.current) return;
      hasCalledApi.current = true;

      try {
        console.log('[Verification] Starting verification for ID:', certificateId);
        
        // Always use API for verification - this ensures proper server-side view counting
        // The API handles IP-based deduplication to prevent abuse
        const response = await fetch(`/api/verify/${certificateId}`);
        const data = await response.json();
        console.log('[Verification] API response:', response.status, data);

        if (!response.ok) {
          // Certificate not found
          setError(data.error || 'Certificate not found');
          setResult({ isValid: false });
        } else {
          setResult(data);
        }
      } catch (err) {
        console.error('[Verification] Error:', err);
        setError('Verification error. Please try again.');
        setResult({ isValid: false });
      } finally {
        setLoading(false);
      }
    }

    verifyCertificate();
  }, [certificateId]);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent" />
            <span className="font-display text-xl font-bold">Serenity</span>
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Verifying certificate...</p>
          </div>
        ) : result?.isValid && result.certificate ? (
          <div className="animate-fade-in">
            {/* Success Header */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
              <h1 className="font-display text-3xl font-bold text-green-500">
                Verified Certificate
              </h1>
              <p className="mt-2 text-muted-foreground">
                This certificate is authentic and valid
              </p>
            </div>

            {/* Certificate Image (if available) */}
            {result.certificate.certificateImage && (
              <div className="mb-8 overflow-hidden rounded-xl border border-border shadow-lg">
                <div className="relative aspect-[1.414/1] w-full bg-muted">
                  <img
                    src={result.certificate.certificateImage}
                    alt={`Certificate for ${result.certificate.recipientName}`}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex items-center justify-between border-t border-border bg-card p-4">
                  <span className="text-sm text-muted-foreground">Certificate Preview</span>
                  <a
                    href={result.certificate.certificateImage}
                    download={`certificate-${result.certificate.recipientName.replace(/\s+/g, '-').toLowerCase()}.png`}
                    className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </div>
              </div>
            )}

            {/* Certificate Details Card */}
            <div className="card overflow-hidden">
              {/* Header gradient */}
              <div className="h-3 bg-gradient-to-r from-primary to-accent" />
              
              <div className="p-6 sm:p-8">
                {/* Recipient Info */}
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white text-2xl font-bold">
                    {result.certificate.recipientName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-wider text-muted-foreground">
                      Awarded to
                    </p>
                    <h2 className="font-display text-2xl font-bold">
                      {result.certificate.recipientName}
                    </h2>
                    {result.certificate.recipientEmail && (
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {result.certificate.recipientEmail}
                      </p>
                    )}
                  </div>
                </div>

                {/* Certificate Title */}
                <div className="mb-6 rounded-lg bg-primary/5 p-4 text-center">
                  <p className="text-sm uppercase tracking-wider text-muted-foreground">
                    Certificate Title
                  </p>
                  <h3 className="mt-1 font-display text-xl font-semibold text-primary">
                    {result.certificate.title}
                  </h3>
                </div>

                {/* Details Grid */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex items-center gap-3 rounded-lg bg-muted p-4">
                    <Building className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Issued by</p>
                      <p className="font-medium truncate">{result.certificate.issuerName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg bg-muted p-4">
                    <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Issued on</p>
                      <p className="font-medium">
                        {formatDate(result.certificate.issuedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg bg-muted p-4">
                    <Eye className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Verified</p>
                      <p className="font-medium">
                        {result.certificate.viewCount} time{result.certificate.viewCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Certificate ID */}
                <div className="mt-6 rounded-lg border border-border bg-muted/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Certificate ID</p>
                      <code className="mt-1 block font-mono text-sm">{certificateId}</code>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(certificateId);
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="mt-6 rounded-lg bg-green-500/10 p-4 text-center text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="mx-auto mb-2 h-5 w-5" />
              This certificate was verified on our secure system.
              <br />
              The verification URL or QR code links directly to this page.
            </div>
          </div>
        ) : (
          <div className="animate-fade-in text-center">
            {/* Error/Invalid State */}
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
              {error?.includes('not found') ? (
                <AlertTriangle className="h-10 w-10 text-yellow-500" />
              ) : (
                <XCircle className="h-10 w-10 text-red-500" />
              )}
            </div>
            
            <h1 className="font-display text-3xl font-bold text-red-500">
              {error?.includes('not found') ? 'Certificate Not Found' : 'Verification Failed'}
            </h1>
            
            <p className="mt-4 text-muted-foreground">
              {error || 'This certificate could not be verified.'}
            </p>

            <div className="mt-8 rounded-lg border border-border bg-muted/50 p-6">
              <h3 className="font-semibold">What this means:</h3>
              <ul className="mt-3 space-y-2 text-left text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  The certificate ID may be incorrect or expired
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  The certificate may have been revoked by the issuer
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  <strong>Note:</strong> Certificates stored locally are only accessible on the device where they were generated
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  The QR code may have been tampered with
                </li>
              </ul>
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              Certificate ID: <code className="rounded bg-muted px-2 py-1">{certificateId}</code>
            </p>
          </div>
        )}

        {/* Footer CTA */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Create your own verified certificates with
          </p>
          <Link
            href="/"
            className="mt-2 inline-flex items-center gap-2 font-display font-semibold text-primary hover:underline"
          >
            Serenity Certificate Generator
            <span>→</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
