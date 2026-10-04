import { put, del } from '@vercel/blob';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Public object storage used by the media and certificate-image routes.
 *
 * Production and preview deployments use Vercel Blob. Emulator mode never
 * talks to Vercel Blob: `.env.local` holds a production BLOB_READ_WRITE_TOKEN
 * and Next.js loads it even when the Firebase emulators are in use, so local
 * testing previously wrote real objects to the production store. In emulator
 * mode objects are written to `.local-object-store/` and served by the
 * emulator-only `/api/dev-object` route instead.
 */

export interface StoredObject {
  url: string;
  pathname: string;
}

interface PutOptions {
  contentType: string;
  /** Request origin, used to build the local URL in emulator mode. */
  origin: string;
  allowOverwrite?: boolean;
}

const LOCAL_ROOT = path.join(process.cwd(), '.local-object-store', 'objects');
const LOCAL_ROUTE = '/api/dev-object/';

export function isLocalObjectStore(): boolean {
  return process.env.USE_FIREBASE_EMULATORS === 'true';
}

/**
 * Origin the browser used, for local object URLs. Next reports loopback hosts
 * as "localhost" in request.nextUrl, which would point stored URLs at a
 * different origin than the one serving the app.
 */
export function requestOrigin(request: { headers: Headers; nextUrl: URL }): string {
  const host = request.headers.get('host');
  return host ? `${request.nextUrl.protocol}//${host}` : request.nextUrl.origin;
}

/** Rejects traversal, absolute paths, and characters outside a safe set. */
export function toSafeObjectPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) throw new Error('Object path is required');
  for (const segment of segments) {
    if (segment === '.' || segment === '..' || !/^[A-Za-z0-9._-]+$/.test(segment)) {
      throw new Error('Object path contains an unsupported segment');
    }
  }
  return segments.join('/');
}

function localFilePath(safePath: string): string {
  const target = path.join(LOCAL_ROOT, ...safePath.split('/'));
  if (!target.startsWith(LOCAL_ROOT + path.sep)) {
    throw new Error('Object path escapes the local store');
  }
  return target;
}

export async function putPublicObject(
  pathname: string,
  body: Buffer,
  { contentType, origin, allowOverwrite = false }: PutOptions,
): Promise<StoredObject> {
  const safePath = toSafeObjectPath(pathname);

  if (isLocalObjectStore()) {
    const target = localFilePath(safePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    const base = origin.replace(/\/$/, '');
    return { url: `${base}${LOCAL_ROUTE}${safePath}`, pathname: safePath };
  }

  const blob = await put(safePath, body, { contentType, access: 'public', allowOverwrite });
  return { url: blob.url, pathname: blob.pathname };
}

export async function deletePublicObject(url: string): Promise<void> {
  if (isLocalObjectStore()) {
    const marker = url.indexOf(LOCAL_ROUTE);
    if (marker === -1) return;
    const safePath = toSafeObjectPath(decodeURIComponent(url.slice(marker + LOCAL_ROUTE.length)));
    await unlink(localFilePath(safePath)).catch(() => undefined);
    return;
  }

  await del(url);
}

/** Emulator-only reader for the dev object route. */
export async function readLocalObject(safePath: string): Promise<Buffer | null> {
  if (!isLocalObjectStore()) return null;
  try {
    return await readFile(localFilePath(toSafeObjectPath(safePath)));
  } catch {
    return null;
  }
}

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  json: 'application/json',
  pdf: 'application/pdf',
};

export function contentTypeForPath(safePath: string): string {
  const extension = safePath.slice(safePath.lastIndexOf('.') + 1).toLowerCase();
  return CONTENT_TYPES[extension] || 'application/octet-stream';
}
