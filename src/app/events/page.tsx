'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Tags,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAuth, AuthLoading } from '@/contexts/AuthContext';
import { authenticatedFetch } from '@/lib/api/authFetch';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import type { EventInput, SerenityEvent } from '@/types/events';
import { SerenityBrand } from '@/components/brand/SerenityBrand';
import { EVENTS_ENABLED } from '@/lib/featureFlags';
import { notFound } from 'next/navigation';

const EVENT_TYPES = [
  'Hackathon',
  'Workshop',
  'Course',
  'Conference',
  'Competition',
  'Training',
  'Webinar',
  'Community',
  'Corporate',
  'Other',
];

type EventDraft = Omit<EventInput, 'galleryImageUrls' | 'links' | 'tags'> & {
  galleryImageUrlsText: string;
  linksText: string;
  tagsText: string;
};

const EMPTY_DRAFT: EventDraft = {
  name: '',
  type: 'Hackathon',
  description: '',
  organizerName: '',
  startAt: '',
  endAt: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  venueName: '',
  address: '',
  city: '',
  country: '',
  websiteUrl: '',
  registrationUrl: '',
  coverImageUrl: '',
  galleryImageUrlsText: '',
  linksText: '',
  tagsText: '',
};

function toLocalInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function draftFromEvent(event: SerenityEvent): EventDraft {
  return {
    name: event.name,
    type: event.type,
    description: event.description || '',
    organizerName: event.organizerName || '',
    startAt: toLocalInput(event.startAt),
    endAt: toLocalInput(event.endAt),
    timezone: event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    venueName: event.venueName || '',
    address: event.address || '',
    city: event.city || '',
    country: event.country || '',
    websiteUrl: event.websiteUrl || '',
    registrationUrl: event.registrationUrl || '',
    coverImageUrl: event.coverImageUrl || '',
    galleryImageUrlsText: event.galleryImageUrls.join('\n'),
    linksText: event.links.map((link) => `${link.label} | ${link.url}`).join('\n'),
    tagsText: event.tags.join(', '),
  };
}

function draftToInput(draft: EventDraft): EventInput {
  return {
    name: draft.name,
    type: draft.type,
    description: draft.description,
    organizerName: draft.organizerName,
    startAt: draft.startAt ? new Date(draft.startAt).toISOString() : undefined,
    endAt: draft.endAt ? new Date(draft.endAt).toISOString() : undefined,
    timezone: draft.timezone,
    venueName: draft.venueName,
    address: draft.address,
    city: draft.city,
    country: draft.country,
    websiteUrl: draft.websiteUrl,
    registrationUrl: draft.registrationUrl,
    coverImageUrl: draft.coverImageUrl,
    galleryImageUrls: draft.galleryImageUrlsText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    links: draft.linksText.split(/\r?\n/).flatMap((line) => {
      const [label, ...urlParts] = line.split('|');
      const url = urlParts.join('|').trim();
      return label?.trim() && url ? [{ label: label.trim(), url }] : [];
    }),
    tags: draft.tagsText.split(',').map((value) => value.trim()).filter(Boolean),
  };
}

function formatDateRange(event: SerenityEvent) {
  if (!event.startAt) return 'Date not set';
  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : null;
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(start);
  return end ? `${date} – ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(end)}` : date;
}

function Field({ label, optional = true, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">optional</span>}
      </span>
      {children}
    </label>
  );
}

export default function EventsPage() {
  const { user, isLoading } = useAuth();
  const [events, setEvents] = useState<SerenityEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [editing, setEditing] = useState<SerenityEvent | null>(null);
  const [draft, setDraft] = useState<EventDraft>(EMPTY_DRAFT);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!user) return;
    setLoadingEvents(true);
    try {
      const response = await authenticatedFetch('/api/events?limit=100');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load events.');
      setEvents(data.events || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load events.');
    } finally {
      setLoadingEvents(false);
    }
  }, [user]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...EMPTY_DRAFT });
    setError(null);
    setShowForm(true);
  };

  const openEdit = (event: SerenityEvent) => {
    setEditing(event);
    setDraft(draftFromEvent(event));
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await authenticatedFetch(editing ? `/api/events/${editing.id}` : '/api/events', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftToInput(draft)),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save event.');
      setEvents((current) => editing
        ? current.map((event) => event.id === editing.id ? data.event : event)
        : [data.event, ...current]);
      setShowForm(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save event.');
    } finally {
      setSaving(false);
    }
  };

  const archive = async (event: SerenityEvent) => {
    if (!window.confirm(`Archive “${event.name}”? Existing certificates will keep their event link, but the event will no longer be selectable for new templates.`)) return;
    const response = await authenticatedFetch(`/api/events/${event.id}`, { method: 'DELETE' });
    if (response.ok) setEvents((current) => current.filter((item) => item.id !== event.id));
  };

  const eventCountLabel = useMemo(() => `${events.length} event${events.length === 1 ? '' : 's'}`, [events.length]);

  if (!EVENTS_ENABLED) notFound();

  if (isLoading || !user) return <AuthLoading />;

  return (
    <main className="app-shell min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-transparent px-3 pt-3 sm:px-5">
        <div className="app-nav-frame mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-4 shadow-xl backdrop-blur-2xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/"><SerenityBrand /></Link>
            <Link href="/dashboard" className="hidden items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground sm:inline-flex">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" />Create event</button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgb(var(--color-primary)/.16),transparent_35%),radial-gradient(circle_at_85%_30%,rgb(var(--color-accent)/.12),transparent_32%)]" />
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">Event context</p>
          <div className="mt-3 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Connect certificates to the story behind them.</h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">
                Events are optional. Add the details that matter: schedule, venue, links, organizer, and imagery. Then link an event from Certificate Information in the editor.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card/70 px-5 py-4 shadow-sm backdrop-blur">
              <p className="text-2xl font-bold">{eventCountLabel}</p>
              <p className="text-sm text-muted-foreground">available to link</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        {error && !showForm && <p className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300">{error}</p>}
        {loadingEvents ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => <div key={item} className="h-72 animate-pulse rounded-3xl border border-border bg-muted/40" />)}
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-primary/30 bg-primary/5 px-6 py-20 text-center">
            <CalendarDays className="mx-auto h-12 w-12 text-primary" />
            <h2 className="mt-5 font-display text-2xl font-bold">No event context yet</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Create the hackathon, workshop, course, or ceremony first. Every field except the event name can be left blank and completed later.</p>
            <button onClick={openCreate} className="btn-primary mt-7"><Plus className="h-4 w-4" />Create your first event</button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
              <article key={event.id} className="group overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
                <div className="relative h-36 overflow-hidden bg-gradient-to-br from-indigo-500/25 via-violet-500/20 to-pink-500/25">
                  {event.coverImageUrl ? <Image src={event.coverImageUrl} alt="" fill unoptimized sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" /> : <CalendarDays className="absolute bottom-5 right-5 h-16 w-16 text-primary/25" />}
                  <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-slate-950/70 px-3 py-1 text-xs font-bold text-white backdrop-blur">{event.type}</span>
                </div>
                <div className="p-5">
                  <h2 className="font-display text-xl font-bold">{event.name}</h2>
                  <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{event.description || 'No description added yet.'}</p>
                  <div className="mt-5 space-y-2 text-sm text-muted-foreground">
                    <p className="flex gap-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{formatDateRange(event)}</p>
                    <p className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{[event.venueName, event.city, event.country].filter(Boolean).join(', ') || 'Location not set'}</p>
                    <p className="flex gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{event.organizerName || 'Organizer not set'}</p>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <div className="flex gap-2">
                      {event.websiteUrl && <a href={event.websiteUrl} target="_blank" rel="noreferrer" className="toolbar-button" aria-label="Open event website"><ExternalLink className="h-4 w-4" /></a>}
                      {event.tags.length > 0 && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Tags className="h-3.5 w-3.5" />{event.tags.length}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(event)} className="toolbar-button" aria-label={`Edit ${event.name}`}><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => void archive(event)} className="toolbar-button text-red-500" aria-label={`Archive ${event.name}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-sm sm:p-8">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between border-b border-border bg-gradient-to-r from-primary/10 via-transparent to-accent/10 p-6 sm:p-8">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">{editing ? 'Edit event' : 'New event'}</p>
                <h2 className="mt-2 font-display text-3xl font-bold">{editing ? editing.name : 'Add useful context, not busywork.'}</h2>
                <p className="mt-2 text-sm text-muted-foreground">Only the event name is required. Everything else is optional and can be refined later.</p>
              </div>
              <button onClick={() => setShowForm(false)} className="toolbar-button" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8 p-6 sm:p-8">
              {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300">{error}</p>}
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Event name" optional={false}><input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="input" placeholder="Serenity Buildathon 2026" /></Field>
                <Field label="Event type" optional={false}><select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })} className="input">{EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></Field>
              </div>
              <Field label="Description"><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="input min-h-28 py-3" maxLength={2000} placeholder="What happened, who participated, and why the event matters." /></Field>

              <div>
                <h3 className="mb-4 flex items-center gap-2 font-display text-xl font-bold"><Clock3 className="h-5 w-5 text-primary" />Schedule and organizer</h3>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Starts"><input type="datetime-local" value={draft.startAt} onChange={(e) => setDraft({ ...draft, startAt: e.target.value })} className="input" /></Field>
                  <Field label="Ends"><input type="datetime-local" value={draft.endAt} onChange={(e) => setDraft({ ...draft, endAt: e.target.value })} className="input" /></Field>
                  <Field label="Timezone"><input value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })} className="input" placeholder="Asia/Kolkata" /></Field>
                  <Field label="Organizer"><input value={draft.organizerName} onChange={(e) => setDraft({ ...draft, organizerName: e.target.value })} className="input" placeholder="Organization or community" /></Field>
                </div>
              </div>

              <div>
                <h3 className="mb-4 flex items-center gap-2 font-display text-xl font-bold"><MapPin className="h-5 w-5 text-primary" />Venue</h3>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Venue name"><input value={draft.venueName} onChange={(e) => setDraft({ ...draft, venueName: e.target.value })} className="input" placeholder="Innovation Hall" /></Field>
                  <Field label="Street address"><input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} className="input" /></Field>
                  <Field label="City"><input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} className="input" /></Field>
                  <Field label="Country"><input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} className="input" /></Field>
                </div>
              </div>

              <div>
                <h3 className="mb-4 flex items-center gap-2 font-display text-xl font-bold"><Link2 className="h-5 w-5 text-primary" />Links</h3>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Event website"><input type="url" value={draft.websiteUrl} onChange={(e) => setDraft({ ...draft, websiteUrl: e.target.value })} className="input" placeholder="https://event.example.com" /></Field>
                  <Field label="Registration page"><input type="url" value={draft.registrationUrl} onChange={(e) => setDraft({ ...draft, registrationUrl: e.target.value })} className="input" placeholder="https://event.example.com/register" /></Field>
                </div>
                <div className="mt-5"><Field label="Additional links"><textarea value={draft.linksText} onChange={(e) => setDraft({ ...draft, linksText: e.target.value })} className="input min-h-24 py-3 font-mono text-xs" placeholder={'Results | https://example.com/results\nPhoto album | https://example.com/photos'} /><p className="mt-2 text-xs text-muted-foreground">One per line in “Label | URL” format.</p></Field></div>
              </div>

              <div>
                <h3 className="mb-4 flex items-center gap-2 font-display text-xl font-bold"><ImageIcon className="h-5 w-5 text-primary" />Images and discovery</h3>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Cover image URL"><input type="url" value={draft.coverImageUrl} onChange={(e) => setDraft({ ...draft, coverImageUrl: e.target.value })} className="input" placeholder="https://…" /></Field>
                  <Field label="Tags"><input value={draft.tagsText} onChange={(e) => setDraft({ ...draft, tagsText: e.target.value })} className="input" placeholder="open source, students, web" /></Field>
                </div>
                <div className="mt-5"><Field label="Gallery image URLs"><textarea value={draft.galleryImageUrlsText} onChange={(e) => setDraft({ ...draft, galleryImageUrlsText: e.target.value })} className="input min-h-24 py-3 font-mono text-xs" placeholder={'https://…/photo-1.jpg\nhttps://…/photo-2.jpg'} /><p className="mt-2 text-xs text-muted-foreground">Up to 12 image URLs, one per line. Existing Serenity media URLs can be used.</p></Field></div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary min-w-36">{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : editing ? 'Save changes' : 'Create event'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
