import { AggregateField, FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { UserRecord } from 'firebase-admin/auth';
import { unstable_cache, revalidateTag } from 'next/cache';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import { summarizePremium } from '@/lib/plans/premium';
import { ReadMeter } from './usage';

/**
 * Read-budget-aware analytics for the operator console.
 *
 * Principles:
 * - Identity and activity come from Firebase Auth (free, no Firestore reads).
 * - Totals use aggregation queries: about one read per 1,000 documents.
 * - Lists are cursor-paginated pages of at most 50 documents with field masks.
 * - Nothing is added to the user-facing hot paths; the only new write there is
 *   one small batch summary per generation.
 */

type Row = Record<string, unknown>;

function iso(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return Number.isNaN(Date.parse(value)) ? null : new Date(value).toISOString();
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value).toISOString() : null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function countOf(query: Query, meter: ReadMeter): Promise<number> {
  const snapshot = await query.count().get();
  const count = snapshot.data().count;
  meter.aggregate(count);
  return count;
}

/* ----------------------------------------------------------------------------
 * Firebase Auth directory (free)
 * ------------------------------------------------------------------------- */

const AUTH_DIRECTORY_TTL_MS = 2 * 60_000;
const AUTH_DIRECTORY_MAX_PAGES = 20;
let authDirectory: { users: UserRecord[]; loadedAt: number } | null = null;

async function loadAuthDirectory(force = false): Promise<UserRecord[]> {
  if (!force && authDirectory && Date.now() - authDirectory.loadedAt < AUTH_DIRECTORY_TTL_MS) {
    return authDirectory.users;
  }
  const users: UserRecord[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < AUTH_DIRECTORY_MAX_PAGES; page += 1) {
    const result = await getAdminAuth().listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
    if (!pageToken) break;
  }
  authDirectory = { users, loadedAt: Date.now() };
  return users;
}

function lastActive(user: UserRecord): string | null {
  return iso(user.metadata.lastRefreshTime) || iso(user.metadata.lastSignInTime);
}

/* ----------------------------------------------------------------------------
 * Overview
 * ------------------------------------------------------------------------- */

export interface OverviewData {
  generatedAt: string;
  estimatedReads: number;
  totals: {
    accounts: number;
    verifiedAccounts: number;
    profiles: number;
    premiumUsers: number;
    creators: number;
    newAccounts7d: number;
    newAccounts30d: number;
    activeAccounts7d: number;
    certificates: number;
    certificates7d: number;
    certificates30d: number;
    revokedCertificates: number;
    emailedCertificates: number;
    failedEmails: number;
    emailSends: number;
    verificationViews: number;
    templates: number;
    publicTemplates: number;
    batches: number;
    leads: number;
    waitlist: number;
  };
  providers: Array<{ provider: string; accounts: number }>;
  series: { days: string[]; certificates: number[]; accounts: number[] };
  topCreators: Array<{ uid: string; name: string | null; email: string | null; certificatesGenerated: number; premium: boolean }>;
}

const SERIES_DAYS = 14;

function startOfUtcDay(offsetDays: number): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - offsetDays * 86_400_000;
}

/**
 * Certificates created by deployed releases store `createdAt` as an ISO
 * string; development builds briefly stored Timestamps. Range filters only
 * match one type, so both are counted.
 */
async function countCertificatesBetween(fromMs: number, toMs: number | null, meter: ReadMeter): Promise<number> {
  const certificates = getAdminFirestore().collection('certificates');
  let asString: Query = certificates.where('createdAt', '>=', new Date(fromMs).toISOString());
  let asTimestamp: Query = certificates.where('createdAt', '>=', Timestamp.fromMillis(fromMs));
  if (toMs !== null) {
    asString = asString.where('createdAt', '<', new Date(toMs).toISOString());
    asTimestamp = asTimestamp.where('createdAt', '<', Timestamp.fromMillis(toMs));
  }
  const [strings, timestamps] = await Promise.all([countOf(asString, meter), countOf(asTimestamp, meter)]);
  return strings + timestamps;
}

async function computeOverview(): Promise<OverviewData> {
  const meter = new ReadMeter();
  const db = getAdminFirestore();
  const users = db.collection('users');
  const certificates = db.collection('certificates');
  const now = Date.now();
  const day = 86_400_000;

  const directory = await loadAuthDirectory(true);
  const providerCounts = new Map<string, number>();
  for (const account of directory) {
    const providers = account.providerData.length > 0 ? account.providerData.map((entry) => entry.providerId) : ['password'];
    for (const provider of Array.from(new Set(providers))) providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
  }
  const createdWithin = (days: number) => directory.filter((account) => Date.parse(account.metadata.creationTime) >= now - days * day).length;
  const activeWithin = (days: number) => directory.filter((account) => {
    const seen = lastActive(account);
    return seen !== null && Date.parse(seen) >= now - days * day;
  }).length;

  const viewsQuery = certificates.aggregate({ views: AggregateField.sum('viewCount') });

  const [
    profiles, premiumUsers, creators,
    certificatesTotal, certificates7d, certificates30d, revoked, emailed, failedEmails,
    emailSends, templates, publicTemplates, batches, leads, waitlist, viewsSnapshot, topCreatorsSnapshot,
  ] = await Promise.all([
    countOf(users, meter),
    countOf(users.where('isPremium', '==', true), meter),
    countOf(users.where('certificatesGenerated', '>', 0), meter),
    countOf(certificates, meter),
    countCertificatesBetween(now - 7 * day, null, meter),
    countCertificatesBetween(now - 30 * day, null, meter),
    countOf(certificates.where('isActive', '==', false), meter),
    countOf(certificates.where('emailStatus', '==', 'sent'), meter),
    countOf(certificates.where('emailStatus', '==', 'failed'), meter),
    countOf(db.collection('emailLogs'), meter),
    countOf(db.collection('templates'), meter),
    countOf(db.collection('templates').where('isPublic', '==', true), meter),
    countOf(db.collection('generationBatches'), meter),
    countOf(db.collection('leads'), meter),
    countOf(db.collection('waitlist'), meter),
    viewsQuery.get(),
    users.orderBy('certificatesGenerated', 'desc').limit(5)
      .select('name', 'email', 'certificatesGenerated', 'isPremium', 'premiumUntil').get(),
  ]);
  meter.aggregate(certificatesTotal);
  meter.query(topCreatorsSnapshot.size);

  const days: string[] = [];
  const dayStarts: number[] = [];
  for (let offset = SERIES_DAYS - 1; offset >= 0; offset -= 1) {
    const start = startOfUtcDay(offset);
    dayStarts.push(start);
    days.push(new Date(start).toISOString().slice(0, 10));
  }
  const certificateSeries = await Promise.all(
    dayStarts.map((start) => countCertificatesBetween(start, start + day, meter)),
  );
  const accountSeries = dayStarts.map((start) => directory.filter((account) => {
    const created = Date.parse(account.metadata.creationTime);
    return created >= start && created < start + day;
  }).length);

  return {
    generatedAt: new Date().toISOString(),
    estimatedReads: meter.reads,
    totals: {
      accounts: directory.length,
      verifiedAccounts: directory.filter((account) => account.emailVerified).length,
      profiles,
      premiumUsers,
      creators,
      newAccounts7d: createdWithin(7),
      newAccounts30d: createdWithin(30),
      activeAccounts7d: activeWithin(7),
      certificates: certificatesTotal,
      certificates7d,
      certificates30d,
      revokedCertificates: revoked,
      emailedCertificates: emailed,
      failedEmails,
      emailSends,
      verificationViews: num(viewsSnapshot.data().views),
      templates,
      publicTemplates,
      batches,
      leads,
      waitlist,
    },
    providers: Array.from(providerCounts.entries())
      .map(([provider, accounts]) => ({ provider, accounts }))
      .sort((a, b) => b.accounts - a.accounts),
    series: { days, certificates: certificateSeries, accounts: accountSeries },
    topCreators: topCreatorsSnapshot.docs.map((document) => {
      const data = document.data();
      return {
        uid: document.id,
        name: str(data.name),
        email: str(data.email),
        certificatesGenerated: num(data.certificatesGenerated),
        premium: summarizePremium(data).active,
      };
    }),
  };
}

const OVERVIEW_TAG = 'console-overview';

/** Cached for 10 minutes so repeated console visits cost no Firestore reads. */
export async function getOverview(options: { refresh?: boolean } = {}): Promise<{ data: OverviewData; cached: boolean }> {
  if (options.refresh) {
    try {
      revalidateTag(OVERVIEW_TAG);
    } catch {
      // No shared cache outside a request context.
    }
  }
  let computedNow = false;
  const cached = unstable_cache(
    async () => {
      computedNow = true;
      return computeOverview();
    },
    ['console-overview-v1'],
    { revalidate: 600, tags: [OVERVIEW_TAG] },
  );
  try {
    const data = await cached();
    return { data, cached: !computedNow };
  } catch {
    return { data: await computeOverview(), cached: false };
  }
}

export function invalidateOverview() {
  try {
    revalidateTag(OVERVIEW_TAG);
  } catch {
    // No shared cache outside a request context.
  }
}

/* ----------------------------------------------------------------------------
 * Users
 * ------------------------------------------------------------------------- */

export interface ConsoleUser {
  uid: string;
  email: string | null;
  name: string | null;
  photoURL: string | null;
  providers: string[];
  emailVerified: boolean;
  disabled: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  lastActiveAt: string | null;
  hasProfile: boolean;
  deleted: boolean;
  premium: { active: boolean; until: string | null; expired: boolean; source: string | null; note: string | null; grantedBy: string | null };
  certificatesGenerated: number;
  lastGeneratedAt: string | null;
}

const PROFILE_FIELDS = [
  'name', 'email', 'isPremium', 'premiumUntil', 'premiumSource', 'premiumNote', 'premiumGrantedBy',
  'certificatesGenerated', 'lastGeneratedAt', 'createdAt', 'lastLoginAt', 'isDeleted',
];

function toConsoleUser(uid: string, account: UserRecord | null, profile: Row | null): ConsoleUser {
  const premium = summarizePremium(profile);
  return {
    uid,
    email: account?.email ?? str(profile?.email),
    name: account?.displayName ?? str(profile?.name),
    photoURL: account?.photoURL ?? null,
    providers: account ? Array.from(new Set(account.providerData.map((entry) => entry.providerId))) : [],
    emailVerified: account?.emailVerified ?? false,
    disabled: account?.disabled ?? false,
    createdAt: iso(account?.metadata.creationTime) ?? iso(profile?.createdAt),
    lastSignInAt: iso(account?.metadata.lastSignInTime) ?? iso(profile?.lastLoginAt),
    lastActiveAt: account ? lastActive(account) : iso(profile?.lastLoginAt),
    hasProfile: profile !== null,
    deleted: profile?.isDeleted === true,
    premium: {
      ...premium,
      note: str(profile?.premiumNote),
      grantedBy: str(profile?.premiumGrantedBy),
    },
    certificatesGenerated: num(profile?.certificatesGenerated),
    lastGeneratedAt: iso(profile?.lastGeneratedAt),
  };
}

async function loadProfiles(uids: string[], meter: ReadMeter): Promise<Map<string, Row>> {
  const profiles = new Map<string, Row>();
  if (uids.length === 0) return profiles;
  const db = getAdminFirestore();
  const snapshots = await db.getAll(...uids.map((uid) => db.collection('users').doc(uid)), { fieldMask: PROFILE_FIELDS });
  meter.document(snapshots.length);
  for (const snapshot of snapshots) {
    if (snapshot.exists) profiles.set(snapshot.id, snapshot.data() as Row);
  }
  return profiles;
}

async function loadAccounts(uids: string[]): Promise<Map<string, UserRecord>> {
  const accounts = new Map<string, UserRecord>();
  for (let index = 0; index < uids.length; index += 100) {
    const result = await getAdminAuth().getUsers(uids.slice(index, index + 100).map((uid) => ({ uid })));
    for (const account of result.users) accounts.set(account.uid, account);
  }
  return accounts;
}

export type UserSort = 'newest' | 'active' | 'creators' | 'premium';

export interface UserPage {
  users: ConsoleUser[];
  nextCursor: string | null;
  total: number | null;
}

export async function listUsers(
  options: { sort: UserSort; cursor?: string | null; search?: string | null; limit?: number },
  meter: ReadMeter,
): Promise<UserPage> {
  const limit = Math.min(Math.max(options.limit || 25, 1), 50);
  const search = options.search?.trim();

  if (search) {
    const matches = await searchUsers(search, meter);
    return { users: matches, nextCursor: null, total: matches.length };
  }

  if (options.sort === 'creators' || options.sort === 'premium') {
    const db = getAdminFirestore();
    let query: Query = options.sort === 'creators'
      ? db.collection('users').orderBy('certificatesGenerated', 'desc')
      : db.collection('users').where('isPremium', '==', true);
    if (options.cursor) {
      const cursorDoc = await db.collection('users').doc(options.cursor).get();
      meter.document();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }
    const snapshot = await query.select(...PROFILE_FIELDS).limit(limit + 1).get();
    meter.query(snapshot.size);
    const page = snapshot.docs.slice(0, limit);
    const accounts = await loadAccounts(page.map((document) => document.id));
    return {
      users: page.map((document) => toConsoleUser(document.id, accounts.get(document.id) ?? null, document.data())),
      nextCursor: snapshot.docs.length > limit ? page[page.length - 1].id : null,
      total: null,
    };
  }

  // Newest and most recently active come straight from Firebase Auth.
  const directory = [...await loadAuthDirectory()];
  if (options.sort === 'active') {
    directory.sort((a, b) => (Date.parse(lastActive(b) || '0') || 0) - (Date.parse(lastActive(a) || '0') || 0));
  } else {
    directory.sort((a, b) => Date.parse(b.metadata.creationTime) - Date.parse(a.metadata.creationTime));
  }
  const offset = Math.max(0, Number.parseInt(options.cursor || '0', 10) || 0);
  const page = directory.slice(offset, offset + limit);
  const profiles = await loadProfiles(page.map((account) => account.uid), meter);
  return {
    users: page.map((account) => toConsoleUser(account.uid, account, profiles.get(account.uid) ?? null)),
    nextCursor: offset + limit < directory.length ? String(offset + limit) : null,
    total: directory.length,
  };
}

async function searchUsers(search: string, meter: ReadMeter): Promise<ConsoleUser[]> {
  const found = new Map<string, UserRecord>();
  const auth = getAdminAuth();

  if (search.includes('@')) {
    for (const email of Array.from(new Set([search, search.toLowerCase()]))) {
      try {
        const account = await auth.getUserByEmail(email);
        found.set(account.uid, account);
      } catch {
        // No account with this email.
      }
    }
  } else {
    try {
      const account = await auth.getUser(search);
      found.set(account.uid, account);
    } catch {
      // Not a UID; fall back to a name or partial email match from the directory.
    }
    if (found.size === 0) {
      const needle = search.toLowerCase();
      for (const account of await loadAuthDirectory()) {
        const haystack = `${account.displayName || ''} ${account.email || ''}`.toLowerCase();
        if (haystack.includes(needle)) found.set(account.uid, account);
        if (found.size >= 25) break;
      }
    }
  }

  const profiles = await loadProfiles(Array.from(found.keys()), meter);
  return Array.from(found.values()).map((account) => toConsoleUser(account.uid, account, profiles.get(account.uid) ?? null));
}

/* ----------------------------------------------------------------------------
 * Certificates, batches and delivery
 * ------------------------------------------------------------------------- */

export interface ConsoleCertificate {
  id: string;
  ownerUid: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  title: string | null;
  issuerName: string | null;
  templateName: string | null;
  batchId: string | null;
  createdAt: string | null;
  issuedAt: string | null;
  image: string | null;
  views: number;
  active: boolean;
  email: { status: string; sentAt: string | null; error: string | null; hadAttachment: boolean | null };
}

const CERTIFICATE_FIELDS = [
  'userId', 'recipientName', 'recipientEmail', 'title', 'issuerName', 'templateName', 'generationBatchId',
  'batchId', 'createdAt', 'issuedAt', 'certificateImage', 'viewCount', 'isActive', 'emailStatus', 'emailSentAt',
  'emailError', 'emailHadAttachment', 'rowIndex',
];

function toConsoleCertificate(document: QueryDocumentSnapshot): ConsoleCertificate {
  const data = document.data();
  return {
    id: document.id,
    ownerUid: str(data.userId),
    recipientName: str(data.recipientName),
    recipientEmail: str(data.recipientEmail),
    title: str(data.title),
    issuerName: str(data.issuerName),
    templateName: str(data.templateName),
    batchId: str(data.generationBatchId) ?? str(data.batchId),
    createdAt: iso(data.createdAt),
    issuedAt: iso(data.issuedAt),
    image: str(data.certificateImage),
    views: num(data.viewCount),
    active: data.isActive !== false,
    email: {
      status: str(data.emailStatus) ?? 'not_sent',
      sentAt: iso(data.emailSentAt),
      error: str(data.emailError),
      hadAttachment: typeof data.emailHadAttachment === 'boolean' ? data.emailHadAttachment : null,
    },
  };
}

export async function listCertificates(
  options: { cursor?: string | null; ownerUid?: string | null; limit?: number },
  meter: ReadMeter,
): Promise<{ certificates: ConsoleCertificate[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(options.limit || 24, 1), 48);
  const db = getAdminFirestore();
  const collection = db.collection('certificates');
  let query: Query = options.ownerUid
    ? collection.where('userId', '==', options.ownerUid).orderBy('createdAt', 'desc')
    : collection.orderBy('createdAt', 'desc');

  if (options.cursor) {
    const cursorDoc = await collection.doc(options.cursor).get();
    meter.document();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }

  const snapshot = await query.select(...CERTIFICATE_FIELDS).limit(limit + 1).get();
  meter.query(snapshot.size);
  const page = snapshot.docs.slice(0, limit);
  return {
    certificates: page.map(toConsoleCertificate),
    nextCursor: snapshot.docs.length > limit ? page[page.length - 1].id : null,
  };
}

export interface ConsoleBatch {
  id: string;
  ownerUid: string | null;
  ownerEmail: string | null;
  title: string | null;
  issuerName: string | null;
  templateName: string | null;
  certificateCount: number;
  recipientsWithEmail: number;
  sampleImage: string | null;
  createdAt: string | null;
}

export async function listBatches(
  options: { cursor?: string | null; ownerUid?: string | null; limit?: number },
  meter: ReadMeter,
): Promise<{ batches: ConsoleBatch[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(options.limit || 20, 1), 50);
  const db = getAdminFirestore();
  const collection = db.collection('generationBatches');

  let documents: QueryDocumentSnapshot[];
  let nextCursor: string | null = null;
  if (options.ownerUid) {
    // Equality-only query: served by the automatic index, sorted in memory.
    const snapshot = await collection.where('userId', '==', options.ownerUid).limit(100).get();
    meter.query(snapshot.size);
    documents = snapshot.docs
      .sort((a, b) => String(b.get('createdAt') || '').localeCompare(String(a.get('createdAt') || '')))
      .slice(0, limit);
  } else {
    let query: Query = collection.orderBy('createdAt', 'desc');
    if (options.cursor) {
      const cursorDoc = await collection.doc(options.cursor).get();
      meter.document();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }
    const snapshot = await query.limit(limit + 1).get();
    meter.query(snapshot.size);
    documents = snapshot.docs.slice(0, limit);
    nextCursor = snapshot.docs.length > limit ? documents[documents.length - 1].id : null;
  }

  const owners = await loadAccounts(Array.from(new Set(documents.map((document) => String(document.get('userId') || '')).filter(Boolean))));
  return {
    batches: documents.map((document) => {
      const data = document.data();
      const ownerUid = str(data.userId);
      return {
        id: document.id,
        ownerUid,
        ownerEmail: ownerUid ? owners.get(ownerUid)?.email ?? null : null,
        title: str(data.title),
        issuerName: str(data.issuerName),
        templateName: str(data.templateName),
        certificateCount: num(data.certificateCount),
        recipientsWithEmail: num(data.recipientsWithEmail),
        sampleImage: str(data.sampleImage),
        createdAt: iso(data.createdAt),
      };
    }),
    nextCursor,
  };
}

export async function getBatchRecipients(batchId: string, meter: ReadMeter): Promise<{
  batch: ConsoleBatch | null;
  certificates: ConsoleCertificate[];
  truncated: boolean;
}> {
  const db = getAdminFirestore();
  const [summary, snapshot] = await Promise.all([
    db.collection('generationBatches').doc(batchId).get(),
    db.collection('certificates').where('generationBatchId', '==', batchId).select(...CERTIFICATE_FIELDS).limit(501).get(),
  ]);
  meter.document();
  meter.query(snapshot.size);

  const certificates = snapshot.docs.slice(0, 500).map(toConsoleCertificate);
  const rowIndex = new Map(snapshot.docs.map((document) => [document.id, num(document.get('rowIndex'))]));
  certificates.sort((a, b) => (rowIndex.get(a.id) || 0) - (rowIndex.get(b.id) || 0));

  let batch: ConsoleBatch | null = null;
  if (summary.exists) {
    const data = summary.data() || {};
    const ownerUid = str(data.userId);
    const owner = ownerUid ? (await loadAccounts([ownerUid])).get(ownerUid) : undefined;
    batch = {
      id: summary.id,
      ownerUid,
      ownerEmail: owner?.email ?? null,
      title: str(data.title),
      issuerName: str(data.issuerName),
      templateName: str(data.templateName),
      certificateCount: num(data.certificateCount),
      recipientsWithEmail: num(data.recipientsWithEmail),
      sampleImage: str(data.sampleImage),
      createdAt: iso(data.createdAt),
    };
  }

  return { batch, certificates, truncated: snapshot.docs.length > 500 };
}

export async function listEmailLog(
  options: { cursor?: string | null; limit?: number },
  meter: ReadMeter,
): Promise<{ emails: Array<{ id: string; to: string | null; certificateId: string | null; senderUid: string | null; senderEmail: string | null; sentAt: string | null; hadAttachment: boolean }>; nextCursor: string | null }> {
  const limit = Math.min(Math.max(options.limit || 50, 1), 100);
  const collection = getAdminFirestore().collection('emailLogs');
  let query: Query = collection.orderBy('sentAt', 'desc');
  if (options.cursor) {
    const cursorDoc = await collection.doc(options.cursor).get();
    meter.document();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }
  const snapshot = await query.limit(limit + 1).get();
  meter.query(snapshot.size);
  const page = snapshot.docs.slice(0, limit);
  const senders = await loadAccounts(Array.from(new Set(page.map((document) => String(document.get('userId') || '')).filter(Boolean))));
  return {
    emails: page.map((document) => {
      const data = document.data();
      const senderUid = str(data.userId);
      return {
        id: document.id,
        to: str(data.to),
        certificateId: str(data.certificateId),
        senderUid,
        senderEmail: senderUid ? senders.get(senderUid)?.email ?? null : null,
        sentAt: iso(data.sentAt),
        hadAttachment: data.hasAttachment === true,
      };
    }),
    nextCursor: snapshot.docs.length > limit ? page[page.length - 1].id : null,
  };
}

export async function listLeads(meter: ReadMeter): Promise<{
  leads: Array<{ id: string; email: string | null; userId: string | null; feature: string | null; createdAt: string | null; message: string | null }>;
  waitlist: Array<{ email: string; features: string[]; createdAt: string | null; lastInteraction: string | null }>;
}> {
  const db = getAdminFirestore();
  const [leadsSnapshot, waitlistSnapshot] = await Promise.all([
    db.collection('leads').orderBy('createdAt', 'desc').limit(50).get(),
    db.collection('waitlist').orderBy('createdAt', 'desc').limit(50).get(),
  ]);
  meter.query(leadsSnapshot.size);
  meter.query(waitlistSnapshot.size);

  return {
    leads: leadsSnapshot.docs.map((document) => {
      const data = document.data();
      const metadata = (data.metadata && typeof data.metadata === 'object') ? data.metadata as Row : {};
      return {
        id: document.id,
        email: str(data.email),
        // Older requests stored whatever userId the browser sent; only
        // server-verified IDs may link a request to an account.
        userId: data.userIdVerified === true && str(data.userId) !== 'anonymous' ? str(data.userId) : null,
        feature: str(data.feature),
        createdAt: iso(data.createdAt) ?? iso(data.timestamp),
        message: str(metadata.requirements) ?? str(metadata.message) ?? null,
      };
    }),
    waitlist: waitlistSnapshot.docs.map((document) => {
      const data = document.data();
      return {
        email: str(data.email) ?? document.id,
        features: Array.isArray(data.features) ? data.features.filter((feature): feature is string => typeof feature === 'string') : [],
        createdAt: iso(data.createdAt),
        lastInteraction: iso(data.lastInteraction),
      };
    }),
  };
}

export async function listAudit(meter: ReadMeter): Promise<Array<{ id: string; at: string | null; action: string | null; actorEmail: string | null; target: string | null; details: Row }>> {
  const snapshot = await getAdminFirestore().collection('adminAuditLog').orderBy('at', 'desc').limit(50).get();
  meter.query(snapshot.size);
  return snapshot.docs.map((document) => {
    const data = document.data();
    return {
      id: document.id,
      at: iso(data.at),
      action: str(data.action),
      actorEmail: str(data.actorEmail),
      target: str(data.target),
      details: (data.details && typeof data.details === 'object') ? data.details as Row : {},
    };
  });
}

/* ----------------------------------------------------------------------------
 * User detail and plan changes
 * ------------------------------------------------------------------------- */

export async function getUserDetail(uid: string, meter: ReadMeter): Promise<{
  user: ConsoleUser;
  certificateCount: number;
  certificates: ConsoleCertificate[];
  batches: ConsoleBatch[];
  templates: Array<{ id: string; name: string | null; isPublic: boolean; updatedAt: string | null; thumbnail: string | null; certificateCount: number }>;
} | null> {
  const db = getAdminFirestore();
  let account: UserRecord | null = null;
  try {
    account = await getAdminAuth().getUser(uid);
  } catch {
    account = null;
  }
  const profiles = await loadProfiles([uid], meter);
  const profile = profiles.get(uid) ?? null;
  if (!account && !profile) return null;

  const [certificateCount, certificates, batches, templatesSnapshot] = await Promise.all([
    countOf(db.collection('certificates').where('userId', '==', uid), meter),
    listCertificates({ ownerUid: uid, limit: 12 }, meter),
    listBatches({ ownerUid: uid, limit: 10 }, meter),
    db.collection('templates').where('userId', '==', uid).select('name', 'isPublic', 'updatedAt', 'thumbnail', 'certificateCount').limit(12).get(),
  ]);
  meter.query(templatesSnapshot.size);

  return {
    user: toConsoleUser(uid, account, profile),
    certificateCount,
    certificates: certificates.certificates,
    batches: batches.batches,
    templates: templatesSnapshot.docs
      .map((document) => {
        const data = document.data();
        const thumbnail = str(data.thumbnail);
        return {
          id: document.id,
          name: str(data.name),
          isPublic: data.isPublic === true,
          updatedAt: iso(data.updatedAt),
          thumbnail: thumbnail && (thumbnail.startsWith('data:image/') || thumbnail.startsWith('https://')) ? thumbnail : null,
          certificateCount: num(data.certificateCount),
        };
      })
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
  };
}

export interface PremiumChange {
  uid: string;
  action: 'grant' | 'revoke';
  /** ISO date-time the plan ends, or null for no end date. Ignored on revoke. */
  until: string | null;
  note: string;
  actorEmail: string | null;
  actorUid: string;
}

export async function changePremium(change: PremiumChange): Promise<{ before: ReturnType<typeof summarizePremium>; after: ReturnType<typeof summarizePremium> }> {
  const db = getAdminFirestore();
  const reference = db.collection('users').doc(change.uid);
  const now = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const before = summarizePremium(snapshot.data());

    const update: Row = change.action === 'grant'
      ? {
          isPremium: true,
          premiumSource: 'console',
          premiumGrantedAt: now,
          premiumGrantedBy: change.actorEmail ?? change.actorUid,
          premiumUntil: change.until ?? FieldValue.delete(),
          premiumNote: change.note || FieldValue.delete(),
          premiumUpdatedAt: now,
        }
      : {
          isPremium: false,
          premiumRevokedAt: now,
          premiumRevokedBy: change.actorEmail ?? change.actorUid,
          premiumUntil: FieldValue.delete(),
          premiumNote: change.note || FieldValue.delete(),
          premiumUpdatedAt: now,
        };

    // A signed-up user may not have a profile yet; merge creates a minimal one
    // that the sign-in route later completes without touching the plan fields.
    transaction.set(reference, snapshot.exists ? update : { id: change.uid, ...update }, { merge: true });

    const after = summarizePremium({
      isPremium: change.action === 'grant',
      premiumUntil: change.action === 'grant' ? change.until : null,
      premiumSource: change.action === 'grant' ? 'console' : snapshot.data()?.premiumSource,
    });
    return { before, after };
  });
}
