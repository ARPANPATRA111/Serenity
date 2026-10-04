import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { toIsoDate } from '@/lib/dates';
import { unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';
import { getCertificateStats } from '@/lib/certificates/stats';
import { createLogger } from '@/lib/logger';

const logger = createLogger('DashboardSummary');

// Only the fields the dashboard shows: a template's design (canvasJSON) can be
// hundreds of kilobytes and was downloaded for every card.
const TEMPLATE_FIELDS = ['name', 'thumbnail', 'createdAt', 'updatedAt', 'certificateCount', 'isPublic', 'publicationStatus', 'creatorName', 'stars'];
const CERTIFICATE_FIELDS = ['generationBatchId', 'batchId', 'recipientName', 'title', 'issuerName', 'issuedAt', 'templateId', 'templateName', 'isActive', 'viewCount', 'createdAt', 'emailStatus'];

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const templateLimit = Math.min(Math.max(Number(searchParams.get('templateLimit')) || 6, 1), 12);
    const certificateLimit = Math.min(Math.max(Number(searchParams.get('certificateLimit')) || 12, 1), 25);
    const db = getAdminFirestore();

    const [templatesSnapshot, certificatesSnapshot, stats] = await Promise.all([
      db.collection('templates')
        .where('userId', '==', authUser.uid)
        .orderBy('updatedAt', 'desc')
        .select(...TEMPLATE_FIELDS)
        .limit(templateLimit)
        .get(),
      db.collection('certificates')
        .where('userId', '==', authUser.uid)
        .orderBy('createdAt', 'desc')
        .select(...CERTIFICATE_FIELDS)
        .limit(certificateLimit)
        .get(),
      // Exact account totals; the page falls back to the recent list if unavailable.
      getCertificateStats(db, authUser.uid).catch((error) => {
        logger.warn('Account totals unavailable', { code: String((error as { code?: unknown })?.code ?? 'unknown') });
        return null;
      }),
    ]);

    const templates = templatesSnapshot.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        name: data.name || 'Untitled template',
        canvasJSON: '',
        thumbnail: data.thumbnail || null,
        createdAt: toIsoDate(data.createdAt),
        updatedAt: toIsoDate(data.updatedAt),
        certificateCount: data.certificateCount || 0,
        isPublic: data.isPublic === true,
        publicationStatus: data.publicationStatus || (data.isPublic ? 'public' : 'private'),
        creatorName: data.creatorName || null,
        stars: data.stars || 0,
      };
    });

    const certificates = certificatesSnapshot.docs.map((document) => {
      const data = document.data();
      const createdAt = toIsoDate(data.createdAt);
      return {
        id: document.id,
        batchId: data.generationBatchId || data.batchId || null,
        recipientName: data.recipientName || 'Unknown',
        title: data.title || 'Certificate',
        issuerName: data.issuerName || 'Serenity',
        issuedAt: toIsoDate(data.issuedAt, createdAt),
        templateId: data.templateId || null,
        templateName: data.templateName || null,
        isActive: data.isActive !== false,
        viewCount: data.viewCount || 0,
        createdAt,
        emailStatus: data.emailStatus || 'not_sent',
      };
    });

    return NextResponse.json({
      success: true,
      recentTemplates: templates,
      recentCertificates: certificates,
      stats,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: any) {
    const isMissingIndex = error?.code === 9 || error?.code === 'failed-precondition';
    console.error('[Dashboard Summary] Failed:', error);
    return NextResponse.json({
      success: false,
      error: isMissingIndex
        ? 'Dashboard data is temporarily unavailable while indexes are prepared.'
        : 'Dashboard data is temporarily unavailable.',
      code: isMissingIndex ? 'INDEX_REQUIRED' : 'DASHBOARD_UNAVAILABLE',
    }, { status: 503 });
  }
}
