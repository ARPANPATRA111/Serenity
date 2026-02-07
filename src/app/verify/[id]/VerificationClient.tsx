'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { 
  CheckCircle, 
  XCircle, 
  Eye, 
  Calendar, 
  Building, 
  Loader2, 
  AlertTriangle, 
  Award, 
  Download, 
  Mail, 
  Share2, 
  Linkedin, 
  Copy, 
  Check,
  ExternalLink
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface VerificationClientProps {
  certificateId: string;
}

interface CertificateData {
  id: string;
  recipientName: string;
  recipientEmail?: string;
  title: string;
  description?: string;
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

// Facebook icon component (Lucide doesn't have it)
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

// X (Twitter) icon component
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

export function VerificationClient({ certificateId }: VerificationClientProps) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasCalledApi = useRef(false);

  useEffect(() => {
    async function verifyCertificate() {
      // Prevent double API calls (React StrictMode)
      if (hasCalledApi.current) return;
      hasCalledApi.current = true;

      try {
        console.log('[Verification] Starting verification for ID:', certificateId);
        
        const response = await fetch(`/api/verify/${certificateId}`);
        const data = await response.json();
        console.log('[Verification] API response:', response.status, data);

        if (!response.ok) {
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

  // Update page title when certificate loads
  useEffect(() => {
    if (result?.isValid && result.certificate) {
      document.title = `${result.certificate.title} - ${result.certificate.recipientName} | Serenity`;
    } else if (error) {
      document.title = 'Verification Failed | Serenity';
    }
  }, [result, error]);

  const handleCopyLink = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getShareUrl = () => {
    return typeof window !== 'undefined' ? window.location.href : '';
  };

  const handleShareLinkedIn = () => {
    const url = getShareUrl();
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      '_blank',
      'width=600,height=600'
    );
  };

  const handleShareFacebook = () => {
    const url = getShareUrl();
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      '_blank',
      'width=600,height=600'
    );
  };

  const handleShareX = () => {
    const url = getShareUrl();
    const text = result?.certificate 
      ? `I'm excited to share that I've received the "${result.certificate.title}" certificate from ${result.certificate.issuerName}! 🎉`
      : 'Check out my certificate!';
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'width=600,height=400'
    );
  };

  const handleAddToLinkedIn = () => {
    if (!result?.certificate) return;
    
    const cert = result.certificate;
    const issuedDate = new Date(cert.issuedAt);
    const year = issuedDate.getFullYear();
    const month = issuedDate.getMonth() + 1; // LinkedIn uses 1-indexed months
    
    // LinkedIn Add to Profile URL
    const params = new URLSearchParams({
      startTask: 'CERTIFICATION_NAME',
      name: cert.title,
      organizationName: cert.issuerName,
      issueYear: year.toString(),
      issueMonth: month.toString(),
      certUrl: getShareUrl(),
      certId: certificateId,
    });
    
    window.open(
      `https://www.linkedin.com/profile/add?${params.toString()}`,
      '_blank',
      'width=600,height=700'
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
            <div className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
              <Award className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <span className="font-display text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Serenity
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10 lg:py-16 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Verifying certificate...</p>
          </div>
        ) : result?.isValid && result.certificate ? (
          <div className="animate-fade-in">
            {/* Two Column Layout for Desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
              {/* Left Column: Certificate Image */}
              <div className="order-1">
                {result.certificate.certificateImage ? (
                  <div className="sticky top-24 overflow-hidden rounded-xl border border-border shadow-lg bg-card">
                    <div className="relative aspect-[1.414/1] w-full bg-muted">
                      {result.certificate.certificateImage.startsWith('data:') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={result.certificate.certificateImage}
                          alt={`Certificate for ${result.certificate.recipientName}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Image
                          src={result.certificate.certificateImage}
                          alt={`Certificate for ${result.certificate.recipientName}`}
                          fill
                          className="object-contain"
                          sizes="(max-width: 1024px) 100vw, 50vw"
                          priority
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t border-border bg-card p-3">
                      <span className="text-xs text-muted-foreground">Certificate Preview</span>
                      <a
                        href={result.certificate.certificateImage}
                        download={`certificate-${result.certificate.recipientName.replace(/\s+/g, '-').toLowerCase()}.png`}
                        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download PNG
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center aspect-[1.414/1] rounded-xl border border-border bg-muted">
                    <div className="text-center text-muted-foreground">
                      <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Certificate Preview</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Certificate Details */}
              <div className="order-2 flex flex-col">
                {/* Verification Badge */}
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    Verified Certificate
                  </span>
                </div>

                {/* Certificate Title */}
                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">
                  {result.certificate.title}
                </h1>

                {/* Issued By */}
                <p className="text-base sm:text-lg text-muted-foreground mb-4">
                  Issued by <span className="font-semibold text-foreground">{result.certificate.issuerName}</span>
                </p>

                {/* Description */}
                {result.certificate.description && (
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    {result.certificate.description}
                  </p>
                )}

                {/* Recipient Card */}
                <div className="rounded-xl border border-border bg-card p-4 sm:p-5 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white text-lg sm:text-xl font-bold shrink-0">
                      {result.certificate.recipientName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        Awarded to
                      </p>
                      <h2 className="font-display text-lg sm:text-xl font-bold truncate">
                        {result.certificate.recipientName}
                      </h2>
                      {result.certificate.recipientEmail && (
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground truncate">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{result.certificate.recipientEmail}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="rounded-lg bg-muted/50 p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Issued on</p>
                    </div>
                    <p className="font-medium text-sm sm:text-base">
                      {formatDate(result.certificate.issuedAt)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Verified</p>
                    </div>
                    <p className="font-medium text-sm sm:text-base">
                      {result.certificate.viewCount} time{result.certificate.viewCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Certificate ID */}
                <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground mb-0.5">Certificate ID</p>
                      <code className="block font-mono text-xs sm:text-sm truncate">{certificateId}</code>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(certificateId)}
                      className="ml-3 text-xs text-primary hover:underline shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => setShareModalOpen(true)}
                    variant="outline"
                    className="flex-1 gap-2"
                  >
                    <Share2 className="h-4 w-4" />
                    Share Award
                  </Button>
                  <Button
                    onClick={handleAddToLinkedIn}
                    className="flex-1 gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white"
                  >
                    <Linkedin className="h-4 w-4" />
                    Add to LinkedIn
                  </Button>
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="mt-8 rounded-lg bg-green-500/10 p-4 text-center text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="mx-auto mb-2 h-5 w-5" />
              This certificate was verified on our secure system.
              <br className="hidden sm:block" />
              <span className="sm:ml-1">The verification URL or QR code links directly to this page.</span>
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

      {/* Share Modal */}
      <Modal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Share Your Achievement"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Share your certificate with the world and celebrate your achievement!
          </p>
          
          <div className="grid gap-3">
            {/* LinkedIn */}
            <button
              onClick={handleShareLinkedIn}
              className="flex items-center gap-3 w-full p-4 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A66C2] text-white">
                <Linkedin className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-medium">Share on LinkedIn</p>
                <p className="text-xs text-muted-foreground">Share with your professional network</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto" />
            </button>

            {/* Facebook */}
            <button
              onClick={handleShareFacebook}
              className="flex items-center gap-3 w-full p-4 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1877F2] text-white">
                <FacebookIcon className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-medium">Share on Facebook</p>
                <p className="text-xs text-muted-foreground">Share with friends and family</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto" />
            </button>

            {/* X (Twitter) */}
            <button
              onClick={handleShareX}
              className="flex items-center gap-3 w-full p-4 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black dark:bg-white text-white dark:text-black">
                <XIcon className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-medium">Share on X</p>
                <p className="text-xs text-muted-foreground">Tweet about your achievement</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto" />
            </button>

            {/* Copy Link */}
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-3 w-full p-4 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
              </div>
              <div className="text-left">
                <p className="font-medium">{copied ? 'Link Copied!' : 'Copy Link'}</p>
                <p className="text-xs text-muted-foreground">Copy verification link to clipboard</p>
              </div>
            </button>
          </div>

          <div className="pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setShareModalOpen(false)} className="w-full">
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
