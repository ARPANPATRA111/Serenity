import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { createLogger, getErrorDetails } from '@/lib/logger';
import { forbiddenResponse, unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';
import { FieldPath, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { toIsoDate } from '@/lib/dates';
import { getEvent } from '@/lib/firebase/events';
import { FREE_CERTIFICATE_LIMIT } from '@/lib/plans/certificateLimits';
import { isPremiumActive } from '@/lib/plans/premium';
import {
  MAX_CERTIFICATES_PER_REQUEST,
  sanitizeCertificateInput,
  type CertificateInput,
} from '@/lib/certificates/record';

const logger = createLogger('Certificates.API');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type HistoryCursor = {
  id: string;
  kind: 'timestamp' | 'string' | 'number';
  value: string | number;
};

function encodeCursor(document: FirebaseFirestore.QueryDocumentSnapshot): string {
  const rawCreatedAt = document.get('createdAt');
  let cursor: HistoryCursor;

  if (rawCreatedAt?.toMillis instanceof Function) {
    cursor = { id: document.id, kind: 'timestamp', value: rawCreatedAt.toMillis() };
  } else if (typeof rawCreatedAt === 'number') {
    cursor = { id: document.id, kind: 'number', value: rawCreatedAt };
  } else {
    cursor = { id: document.id, kind: 'string', value: String(rawCreatedAt || '') };
  }

  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string): { id: string; createdAt: unknown } | null {
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as HistoryCursor;
    if (!cursor.id || !['timestamp', 'string', 'number'].includes(cursor.kind)) return null;

    if (cursor.kind === 'timestamp' && typeof cursor.value === 'number') {
      return { id: cursor.id, createdAt: Timestamp.fromMillis(cursor.value) };
    }
    if (cursor.kind === 'number' && typeof cursor.value === 'number') {
      return { id: cursor.id, createdAt: cursor.value };
    }
    if (cursor.kind === 'string' && typeof cursor.value === 'string') {
      return { id: cursor.id, createdAt: cursor.value };
    }
  } catch {
    return null;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const clientUserId = request.headers.get('x-user-id');
    if (clientUserId && clientUserId !== authUser.uid) {
      return forbiddenResponse('Authenticated user does not match requested user ID');
    }

    const userId = authUser.uid;
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
    const pageSize = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 50;
    const cursorParam = searchParams.get('cursor');
    const cursor = cursorParam ? decodeCursor(cursorParam) : null;

    if (cursorParam && !cursor) {
      return NextResponse.json(
        { success: false, error: 'Invalid history cursor', code: 'INVALID_CURSOR' },
        { status: 400 },
      );
    }

    let db;
    try {
      db = getAdminFirestore();
    } catch (e) {
      logger.warn('Firebase Admin Init Failed', { userId }, e as Error);
      return NextResponse.json({
        success: false,
        error: 'History is temporarily unavailable.',
        code: 'HISTORY_UNAVAILABLE',
      }, { status: 503 });
    }
    
    const certificatesRef = db.collection('certificates');
    
    let query: FirebaseFirestore.Query = certificatesRef
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .orderBy(FieldPath.documentId(), 'desc');

    if (cursor) {
      query = query.startAfter(cursor.createdAt, cursor.id);
    }

    let snapshot: FirebaseFirestore.QuerySnapshot;
    try {
      snapshot = await query.limit(pageSize + 1).get();
    } catch (e: any) {
      const isMissingIndex = e.code === 9 || e.code === 'failed-precondition';
      logger.warn('History query failed', { userId, errorCode: e.code });
      return NextResponse.json({
        success: false,
        error: isMissingIndex
          ? 'History is temporarily unavailable while its index is being prepared.'
          : 'History is temporarily unavailable.',
        code: isMissingIndex ? 'INDEX_REQUIRED' : 'HISTORY_UNAVAILABLE',
      }, { status: 503 });
    }

    const hasMore = snapshot.docs.length > pageSize;
    const pageDocuments = snapshot.docs.slice(0, pageSize);
    const certificates = pageDocuments.map(doc => {
      const data = doc.data();
      const createdAt = toIsoDate(data.createdAt);
      const issuedAt = toIsoDate(data.issuedAt, createdAt);
      return {
        id: doc.id,
        batchId: data.generationBatchId || data.batchId || null,
        recipientName: data.recipientName || 'Unknown',
        recipientEmail: data.recipientEmail || '',
        title: data.title || 'Certificate',
        issuerName: data.issuerName || 'Serenity',
        issuedAt,
        templateId: data.templateId || null,
        templateName: data.templateName || null,
        isActive: data.isActive !== false,
        viewCount: data.viewCount || 0,
        createdAt,
        emailStatus: data.emailStatus || 'not_sent', // 'not_sent' | 'sent' | 'failed'
        emailSentAt: data.emailSentAt?.toDate?.()?.toISOString() || null,
        emailError: data.emailError || null,
        certificateImage: data.certificateImage || null, // URL to certificate image
        thumbnailUrl: data.thumbnailUrl || data.certificateImage || null,
      };
    });

    const nextCursor = hasMore && pageDocuments.length > 0
      ? encodeCursor(pageDocuments[pageDocuments.length - 1])
      : null;

    logger.debug('Fetched certificates', { userId, count: certificates.length });
    return NextResponse.json({
      success: true,
      items: certificates,
      certificates,
      nextCursor,
      hasMore,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const errorDetails = getErrorDetails(error);
    logger.error('Failed to fetch certificates', { error: errorDetails });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch certificates' },
      { status: 500 }
    );
  }
}


interface BatchSummary {
  id: string;
  newCertificates: number;
  newWithEmail: number;
  sample: CertificateInput;
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const body = await request.json().catch(() => null);
    const submitted: unknown = body?.certificates;

    if (!Array.isArray(submitted) || submitted.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Certificates array is required' },
        { status: 400 }
      );
    }

    if (submitted.length > MAX_CERTIFICATES_PER_REQUEST) {
      return NextResponse.json(
        {
          success: false,
          error: `At most ${MAX_CERTIFICATES_PER_REQUEST} certificates can be saved per request`,
          code: 'BATCH_TOO_LARGE',
        },
        { status: 413 },
      );
    }

    const certificates: CertificateInput[] = [];
    const seenCertificateIds = new Set<string>();
    for (const raw of submitted) {
      const claimedOwner = (raw as { userId?: unknown } | null)?.userId;
      if (claimedOwner && claimedOwner !== authUser.uid) {
        return forbiddenResponse('Authenticated user does not match certificate user ID');
      }

      const sanitized = sanitizeCertificateInput(raw);
      if (!sanitized.ok) {
        return NextResponse.json({ success: false, error: sanitized.error }, { status: 400 });
      }

      if (seenCertificateIds.has(sanitized.value.id)) {
        return NextResponse.json(
          { success: false, error: 'Duplicate certificate id in request' },
          { status: 400 }
        );
      }
      seenCertificateIds.add(sanitized.value.id);
      certificates.push(sanitized.value);
    }

    const linkedEventIds = Array.from(new Set(
      certificates
        .map((certificate) => certificate.eventId)
        .filter((eventId): eventId is string => typeof eventId === 'string' && eventId.length > 0),
    ));
    const linkedEvents = await Promise.all(linkedEventIds.map((eventId) => getEvent(eventId)));
    if (linkedEvents.some((event) => !event || event.userId !== authUser.uid || event.archivedAt)) {
      return NextResponse.json({ success: false, error: 'One or more linked events are unavailable.' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const userId = authUser.uid;

    const certRefs = certificates.map((certificate) => db.collection('certificates').doc(certificate.id));
    const userRef = db.collection('users').doc(userId);
    const batchIds = Array.from(new Set(
      certificates
        .map((certificate) => certificate.generationBatchId)
        .filter((batchId): batchId is string => typeof batchId === 'string'),
    ));
    const batchRefs = batchIds.map((batchId) => db.collection('generationBatches').doc(batchId));

    // Reconcile legacy counters before entering the transaction. The user document
    // write below serializes concurrent generation requests from this point onward.
    const countSnapshot = await db.collection('certificates')
      .where('userId', '==', userId)
      .count()
      .get();
    const existingOwnedCount = countSnapshot.data().count;

    const results: string[] = [];
    try {
      await db.runTransaction(async (transaction) => {
        results.length = 0;
        // One round trip for the owner, every certificate, and every batch summary.
        const snapshots = await transaction.getAll(userRef, ...certRefs, ...batchRefs);
        const userDoc = snapshots[0];
        const existingCertDocs = snapshots.slice(1, 1 + certRefs.length);
        const existingBatchDocs = snapshots.slice(1 + certRefs.length);
        const userData = userDoc.data();
        const isPremium = isPremiumActive(userData);

        for (const existingDoc of existingCertDocs) {
          if (existingDoc.exists && existingDoc.data()?.userId !== userId) {
            throw new Error('CERTIFICATE_OWNERSHIP_CONFLICT');
          }
        }

        const newCertificateCount = existingCertDocs.filter((doc) => !doc.exists).length;
        const storedCount = typeof userData?.certificatesGenerated === 'number'
          ? userData.certificatesGenerated
          : 0;
        const authoritativeCount = Math.max(storedCount, existingOwnedCount);
        const newTotal = authoritativeCount + newCertificateCount;

        if (!isPremium && newTotal > FREE_CERTIFICATE_LIMIT) {
          throw new Error(`FREE_LIMIT:${Math.max(0, FREE_CERTIFICATE_LIMIT - authoritativeCount)}`);
        }

        const timestamp = Timestamp.now();
        // Production records store `createdAt` as an ISO string, and history
        // orders by it. Mixing Timestamps in would sort every older record
        // above the new ones, so new records keep the established type.
        const createdAtIso = timestamp.toDate().toISOString();
        const summaries = new Map<string, BatchSummary>();

        certificates.forEach((certificate, index) => {
          const existing = existingCertDocs[index].data();
          transaction.set(certRefs[index], {
            ...certificate,
            userId,
            // Server-owned fields: preserved on retries, never client-supplied.
            isActive: existing?.isActive ?? true,
            viewCount: typeof existing?.viewCount === 'number' ? existing.viewCount : 0,
            ...(existing?.emailStatus ? { emailStatus: existing.emailStatus } : {}),
            ...(existing?.emailSentAt ? { emailSentAt: existing.emailSentAt } : {}),
            generationStatus: 'saved',
            savedAt: timestamp,
            createdAt: existing?.createdAt || createdAtIso,
            updatedAt: timestamp,
          });
          results.push(certificate.id);

          if (certificate.generationBatchId) {
            const summary = summaries.get(certificate.generationBatchId) || {
              id: certificate.generationBatchId,
              newCertificates: 0,
              newWithEmail: 0,
              sample: certificate,
            };
            if (!existingCertDocs[index].exists) {
              summary.newCertificates += 1;
              if (certificate.recipientEmail) summary.newWithEmail += 1;
            }
            if (!summary.sample.certificateImage && certificate.certificateImage) summary.sample = certificate;
            summaries.set(certificate.generationBatchId, summary);
          }
        });

        // One small summary document per generation batch lets the operator
        // console list batches without scanning certificates.
        batchIds.forEach((batchId, index) => {
          const summary = summaries.get(batchId);
          const existingBatch = existingBatchDocs[index];
          if (!summary) return;
          if (existingBatch.exists && existingBatch.data()?.userId !== userId) return;
          transaction.set(batchRefs[index], {
            id: batchId,
            userId,
            templateId: summary.sample.templateId,
            templateName: summary.sample.templateName,
            title: summary.sample.title,
            issuerName: summary.sample.issuerName,
            ...(summary.sample.certificateImage ? { sampleImage: summary.sample.certificateImage } : {}),
            certificateCount: FieldValue.increment(summary.newCertificates),
            recipientsWithEmail: FieldValue.increment(summary.newWithEmail),
            createdAt: existingBatch.data()?.createdAt || createdAtIso,
            updatedAt: createdAtIso,
          }, { merge: true });
        });

        transaction.set(userRef, {
          certificatesGenerated: newTotal,
          lastGeneratedAt: timestamp,
          ...(userData?.firstGeneratedAt ? {} : { firstGeneratedAt: timestamp }),
        }, { merge: true });
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'CERTIFICATE_OWNERSHIP_CONFLICT') {
        return forbiddenResponse('Cannot overwrite a certificate owned by another user');
      }
      if (error instanceof Error && error.message.startsWith('FREE_LIMIT:')) {
        const remaining = Number.parseInt(error.message.split(':')[1] || '0', 10);
        return NextResponse.json({
          success: false,
          error: `Free tier limit reached. You can only generate ${remaining} more certificate(s).`,
          limitReached: true,
          remaining,
        }, { status: 403 });
      }
      logger.error('Batch write failed', { userId, error: getErrorDetails(error) });
      return NextResponse.json({
        success: false,
        error: 'Failed to save certificates',
        retryable: true,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      created: results.length,
      ids: results,
      failed: 0,
    });
  } catch (error) {
    logger.error('POST failed', { error: getErrorDetails(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to create certificates', retryable: true },
      { status: 500 }
    );
  }
}
