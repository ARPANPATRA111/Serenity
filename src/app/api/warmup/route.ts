import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness probe. It previously ran a Firestore query on every call, and since
 * it is public, anyone could spend the project's daily read quota through it.
 * It now answers without touching Firestore.
 */
export async function GET() {
  return NextResponse.json(
    { success: true, message: 'ok' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
