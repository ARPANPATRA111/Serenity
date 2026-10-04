'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Linkedin, Share2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface VerificationActionsProps {
  certificateId: string;
  title: string;
  issuerName: string;
  issuedAt: string;
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function canonicalUrl(certificateId: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/verify/${encodeURIComponent(certificateId)}`;
}

function openPopup(url: string, width: number, height: number) {
  window.open(url, '_blank', `noopener,noreferrer,width=${width},height=${height}`);
}

export function CopyCertificateId({ certificateId }: { certificateId: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(certificateId);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard access can be denied; the ID stays selectable on the page.
        }
      }}
      className="ml-3 inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-semibold text-primary hover:bg-primary/10"
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function VerificationActions({ certificateId, title, issuerName, issuedAt }: VerificationActionsProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(canonicalUrl(certificateId));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the address bar still holds the link.
    }
  };

  const handleAddToLinkedIn = () => {
    const issued = new Date(issuedAt);
    const hasDate = !Number.isNaN(issued.getTime());
    const params = new URLSearchParams({
      startTask: 'CERTIFICATION_NAME',
      name: title,
      organizationName: issuerName,
      certUrl: canonicalUrl(certificateId),
      certId: certificateId,
    });
    if (hasDate) {
      params.set('issueYear', String(issued.getFullYear()));
      params.set('issueMonth', String(issued.getMonth() + 1));
    }
    openPopup(`https://www.linkedin.com/profile/add?${params.toString()}`, 600, 700);
  };

  const shareTargets = [
    {
      label: 'Share on LinkedIn',
      hint: 'Share with your professional network',
      icon: <Linkedin className="h-5 w-5" aria-hidden="true" />,
      tile: 'bg-[#0A66C2] text-white',
      onClick: () => openPopup(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonicalUrl(certificateId))}`, 600, 600),
    },
    {
      label: 'Share on Facebook',
      hint: 'Share with friends and family',
      icon: <FacebookIcon className="h-5 w-5" />,
      tile: 'bg-[#1877F2] text-white',
      onClick: () => openPopup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl(certificateId))}`, 600, 600),
    },
    {
      label: 'Share on X',
      hint: 'Post about your achievement',
      icon: <XIcon className="h-5 w-5" />,
      tile: 'bg-black text-white dark:bg-white dark:text-black',
      onClick: () => {
        const text = `I'm excited to share that I've received the "${title}" certificate from ${issuerName}!`;
        openPopup(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(canonicalUrl(certificateId))}`, 600, 400);
      },
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => setShareOpen(true)} variant="outline" className="flex-1 gap-2">
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Share award
        </Button>
        <Button onClick={handleAddToLinkedIn} className="flex-1 gap-2 bg-[#0A66C2] text-white hover:bg-[#004182]">
          <Linkedin className="h-4 w-4" aria-hidden="true" />
          Add to LinkedIn
        </Button>
      </div>

      <Modal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share your achievement"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Anyone with this link can confirm the certificate is genuine.
          </p>
          <div className="grid gap-3">
            {shareTargets.map((target) => (
              <button
                key={target.label}
                type="button"
                onClick={target.onClick}
                className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted sm:p-4"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${target.tile}`}>
                  {target.icon}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{target.label}</span>
                  <span className="block text-xs text-muted-foreground">{target.hint}</span>
                </span>
                <ExternalLink className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted sm:p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                {copied ? <Check className="h-5 w-5 text-success" aria-hidden="true" /> : <Copy className="h-5 w-5" aria-hidden="true" />}
              </span>
              <span className="min-w-0">
                <span className="block font-medium">{copied ? 'Link copied' : 'Copy link'}</span>
                <span className="block text-xs text-muted-foreground">Copy the verification link</span>
              </span>
            </button>
          </div>
          <div className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => setShareOpen(false)} className="w-full">
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
