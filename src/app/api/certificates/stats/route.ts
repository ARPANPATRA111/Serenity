import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';
import { getCertificateStats } from '@/lib/certificates/stats';
import { createServerTimer } from '@/lib/api/serverTiming';
import { createLogger } from '@/lib/logger';

const logger = createLogger('CertificateStats');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Exact account totals on their own, so the dashboard and history can show
 * their lists without waiting for about a dozen aggregate queries. Both pages
 * share one cached request per account (see accountStatsClient.ts).
 */
export async function GET(request: NextRequest) {
  const timer = createServerTimer();
  const authUser = await timer.measure('auth', verifyAuth(request));
  if (!authUser) return unauthorizedResponse();

  try {
    const stats = await timer.measure('aggregates', getCertificateStats(getAdminFirestore(), authUser.uid));
    return NextResponse.json({ success: true, stats }, {
      headers: { 'Cache-Control': 'private, no-store', 'Server-Timing': timer.header() },
    });
  } catch (error) {
    logger.warn('Account totals unavailable', { code: String((error as { code?: unknown })?.code ?? 'unknown') });
    return NextResponse.json({
      success: false,
      error: 'Account totals are temporarily unavailable.',
      code: 'STATS_UNAVAILABLE',
    }, { status: 503, headers: { 'Cache-Control': 'private, no-store', 'Server-Timing': timer.header() } });
  }
}
