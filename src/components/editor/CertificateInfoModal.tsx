'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useEditorStore } from '@/store/editorStore';
import { Building, FileText, Info, AlertCircle, CheckCircle, Award, Eye, ExternalLink, Tag, CalendarDays, Loader2 } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api/authFetch';
import type { SerenityEvent } from '@/types/events';
import { EVENTS_ENABLED } from '@/lib/featureFlags';

const CATEGORIES = [
  'Education',
  'Corporate',
  'Achievement',
  'Participation',
  'Workshop',
  'Course',
  'Event',
  'Other',
];

interface CertificateInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CertificateInfoModal({ isOpen, onClose }: CertificateInfoModalProps) {
  const { certificateMetadata, setCertificateMetadata } = useEditorStore();
  
  const [title, setTitle] = useState(certificateMetadata.title);
  const [issuedBy, setIssuedBy] = useState(certificateMetadata.issuedBy);
  const [description, setDescription] = useState(certificateMetadata.description);
  const [category, setCategory] = useState(certificateMetadata.category || '');
  const [eventId, setEventId] = useState(certificateMetadata.eventId || '');
  const [events, setEvents] = useState<SerenityEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; issuedBy?: string }>({});
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(certificateMetadata.title);
      setIssuedBy(certificateMetadata.issuedBy);
      setDescription(certificateMetadata.description);
      setCategory(certificateMetadata.category || '');
      setEventId(certificateMetadata.eventId || '');
      setErrors({});
      setShowPreview(false);
    }
  }, [isOpen, certificateMetadata]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setEventsLoading(true);
    authenticatedFetch('/api/events?limit=100')
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load events');
        if (!cancelled) setEvents(data.events || []);
      })
      .catch((error) => console.error('[Certificate Info] Failed to load events:', error))
      .finally(() => { if (!cancelled) setEventsLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleSave = () => {
    const newErrors: { title?: string; issuedBy?: string } = {};
    
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!issuedBy.trim()) {
      newErrors.issuedBy = 'Issued By is required';
    }
    
    // Description and category are optional
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setCertificateMetadata({
      title: title.trim(),
      issuedBy: issuedBy.trim(),
      description: description.trim(),
      category: category || undefined,
      eventId: eventId || undefined,
    });
    
    onClose();
  };

  // Only title and issuedBy are required now
  const isComplete = certificateMetadata.title.trim() && certificateMetadata.issuedBy.trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Certificate Information"
      className="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Toggle between Edit and Preview */}
        <div className="flex items-center gap-2 p-1 rounded-lg bg-muted">
          <button
            onClick={() => setShowPreview(false)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              !showPreview
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="h-4 w-4" />
            Edit Info
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              showPreview
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
        </div>

        {showPreview ? (
          /* Verification Page Preview - Realistic mockup */
          <div className="border border-border rounded-xl overflow-hidden max-h-[70vh] overflow-y-auto">
            <div className="px-4 py-2 bg-muted border-b border-border flex items-center justify-between sticky top-0 z-10">
              <span className="text-xs text-muted-foreground">Verification Page Preview</span>
              <span className="text-xs text-muted-foreground font-mono">/verify/abc123...</span>
            </div>
            <div className="p-4 sm:p-6 bg-gradient-to-br from-background via-background to-muted/30">
              {/* Two column layout preview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: Certificate Image Placeholder */}
                <div className="order-1">
                  <div className="rounded-xl border border-border overflow-hidden bg-card">
                    <div className="aspect-[1.414/1] bg-gradient-to-br from-muted to-muted/50 flex flex-col items-center justify-center gap-2 p-4">
                      <Award className="h-16 w-16 text-muted-foreground/30" />
                      <span className="text-xs text-muted-foreground">Certificate Preview</span>
                      <span className="text-xs text-muted-foreground/60">(Generated image appears here)</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border bg-card p-2">
                      <span className="text-xs text-muted-foreground">Certificate Preview</span>
                      <span className="text-xs text-primary">Download PNG</span>
                    </div>
                  </div>
                </div>

                {/* Right: Certificate Details */}
                <div className="order-2 space-y-3">
                  {/* Verification Badge */}
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/20">
                      <CheckCircle className="h-3 w-3 text-success" />
                    </div>
                    <span className="text-xs font-medium text-success">
                      Verified Certificate
                    </span>
                  </div>

                  {/* Certificate Title */}
                  <h2 className="text-lg sm:text-xl font-bold">
                    {title.trim() || 'Certificate Title'}
                  </h2>

                  {/* Issued By */}
                  <p className="text-sm text-muted-foreground">
                    Issued by <span className="font-semibold text-foreground">{issuedBy || 'Issuer Name'}</span>
                  </p>

                  {/* Description */}
                  {description.trim() && (
                    <p className="text-xs text-muted-foreground">
                      {description.trim()}
                    </p>
                  )}

                  {/* Recipient Card */}
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white text-sm font-bold shrink-0">
                        J
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">
                          Awarded to
                        </p>
                        <p className="font-semibold text-sm">John Doe</p>
                        <p className="text-xs text-muted-foreground">john@example.com</p>
                      </div>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">Issued on</p>
                      <p className="font-medium text-xs">Feb 16, 2026</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">Verified</p>
                      <p className="font-medium text-xs">0 times</p>
                    </div>
                  </div>

                  {/* Certificate ID */}
                  <div className="rounded-md border border-border bg-muted/30 p-2">
                    <p className="text-xs text-muted-foreground">Certificate ID</p>
                    <code className="text-xs font-mono">cert_abc123xyz789</code>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button className="flex-1 py-1.5 px-3 rounded-md border border-border text-xs font-medium bg-card">
                      Share Award
                    </button>
                    <button className="flex-1 py-1.5 px-3 rounded-md bg-[#0A66C2] text-white text-xs font-medium">
                      Add to LinkedIn
                    </button>
                  </div>
                </div>
              </div>

              {/* Security Notice */}
              <div className="mt-4 rounded-md bg-success/10 p-3 text-center">
                <CheckCircle className="mx-auto mb-1 h-4 w-4 text-success" />
                <p className="text-xs text-success">
                  This certificate was verified on our secure system.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Edit Form */
          <>
            {/* Info banner */}
            <div className="flex items-start gap-3 rounded-lg bg-primary/10 p-4">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-primary">Saved With Template</p>
                <p className="text-muted-foreground mt-1">
                  This information is saved with your template and will be applied to all
                  certificates generated from it. It will be displayed on the verification page.
                </p>
              </div>
            </div>

            {/* Title field */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Award className="h-4 w-4 text-muted-foreground" />
                Certificate Title <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors({ ...errors, title: undefined });
                }}
                placeholder="e.g., Certificate of Completion, Achievement Award"
                className={`w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.title ? 'border-destructive' : 'border-border'
                }`}
              />
              {errors.title && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.title}
                </p>
              )}
            </div>

            {/* Issued By field */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                Issued By <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={issuedBy}
                onChange={(e) => {
                  setIssuedBy(e.target.value);
                  if (errors.issuedBy) setErrors({ ...errors, issuedBy: undefined });
                }}
                placeholder="e.g., Acme University, Tech Corp"
                className={`w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.issuedBy ? 'border-destructive' : 'border-border'
                }`}
              />
              {errors.issuedBy && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.issuedBy}
                </p>
              )}
            </div>

            {/* Description field (optional) */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Description <span className="text-muted-foreground text-xs">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  const value = e.target.value.slice(0, 500);
                  setDescription(value);
                }}
                placeholder="e.g., For successfully completing the Web Development Course"
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex justify-end mt-1">
                <span className={`text-xs ${description.length >= 450 ? 'text-warning' : 'text-muted-foreground'}`}>
                  {description.length}/500
                </span>
              </div>
            </div>

            {/* Category field (optional) */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                Category <span className="text-muted-foreground text-xs">(optional - for public templates)</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select a category...</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Helps users find your template when browsing public templates
              </p>
            </div>

            {/* Optional event context */}
            {EVENTS_ENABLED && (
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Linked Event <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </label>
              <select
                value={eventId}
                onChange={(event) => setEventId(event.target.value)}
                disabled={eventsLoading}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
              >
                <option value="">No linked event</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>{event.name} · {event.type}</option>
                ))}
              </select>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{eventsLoading ? <><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Loading events…</> : 'The event will appear as optional context on verification pages.'}</span>
                <Link href="/events" target="_blank" className="shrink-0 font-semibold text-primary hover:underline">Manage events</Link>
              </div>
            </div>
            )}

            {/* Status indicator */}
            <div className={`flex items-center gap-2 rounded-lg p-3 ${
              isComplete ? 'bg-success/10 text-success dark:text-success' : 'bg-warning/10 text-warning dark:text-warning'
            }`}>
              {isComplete ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Certificate info complete</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Please fill in the required fields</span>
                </>
              )}
            </div>
          </>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          {showPreview ? (
            <Button onClick={() => setShowPreview(false)} className="flex-1">
              Back to Edit
            </Button>
          ) : (
            <Button onClick={handleSave} className="flex-1">
              Save Information
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
