import { NextRequest, NextResponse } from 'next/server';
import {
  createTemplate,
  getUserTemplates,
  searchTemplates,
  findTemplateByNormalizedName,
  updateTemplate,
  TEMPLATE_CARD_FIELDS,
  type Template,
} from '@/lib/firebase/templates';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { getOwnerPage, isMissingIndexError } from '@/lib/firebase/ownerPaging';
import { toIsoDate } from '@/lib/dates';
import { createServerTimer } from '@/lib/api/serverTiming';
import { forbiddenResponse, unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';
import { validateTemplateInvariants } from '@/lib/fabric/templateInvariants';
import { getEvent } from '@/lib/firebase/events';
import { searchCuratedTemplates } from '@/lib/templates/curatedPublicTemplates';
import {
  affectsPublicGallery,
  getCachedPublicTemplates,
  invalidatePublicTemplates,
  sanitizePublicTemplate,
} from '@/lib/templates/publicTemplateCache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function rejectMismatchedUserId(clientUserId: unknown, uid: string) {
  if (clientUserId && typeof clientUserId === 'string' && clientUserId !== uid) {
    return forbiddenResponse('Authenticated user does not match requested user ID');
  }

  return null;
}

function filterOwnedTemplates(templates: Template[], query: string): Template[] {
  const lowerQuery = query.toLowerCase();
  return templates.filter(template =>
    template.name.toLowerCase().includes(lowerQuery) ||
    template.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

async function validateLinkedEvent(certificateMetadata: unknown, userId: string) {
  if (!certificateMetadata || typeof certificateMetadata !== 'object') return null;
  const eventId = (certificateMetadata as Record<string, unknown>).eventId;
  if (!eventId) return null;
  if (typeof eventId !== 'string') return 'Linked event ID is invalid.';
  const event = await getEvent(eventId);
  if (!event || event.userId !== userId || event.archivedAt) return 'Linked event is unavailable.';
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const isPublic = searchParams.get('public') === 'true';
    const searchQuery = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let templates: Template[] = [];
    const headers: HeadersInit = {};

    try {
      if (isPublic) {
        if (searchQuery) {
          templates = await searchTemplates(searchQuery, true);
          templates = templates.map(template => sanitizePublicTemplate(template));
          const existingIds = new Set(templates.map(template => template.id));
          templates = [
            ...templates,
            ...searchCuratedTemplates(searchQuery).filter(template => !existingIds.has(template.id)),
          ].slice(0, limit);
        } else {
          templates = await getCachedPublicTemplates(limit);
          headers['Cache-Control'] = 'public, s-maxage=300, stale-while-revalidate=3600';
        }
      } else {
        const authUser = await verifyAuth(request);
        if (!authUser) {
          return unauthorizedResponse();
        }

        const mismatch = rejectMismatchedUserId(userId, authUser.uid);
        if (mismatch) return mismatch;

        // page=1 (current clients): one bounded page of card fields, newest
        // first. Searching still covers every template, as before.
        if (searchParams.get('page') === '1' && !searchQuery) {
          return await ownedTemplatePage(authUser.uid, searchParams);
        }

        templates = await getUserTemplates(authUser.uid);
        if (searchQuery) {
          templates = filterOwnedTemplates(templates, searchQuery);
        }
      }
    } catch (error: any) {
      const isMissingIndex = error?.code === 9 || error?.code === 'failed-precondition';
      console.error('[Templates API] Query failed:', error);
      return NextResponse.json({
        success: false,
        templates: [],
        error: isMissingIndex
          ? 'Templates are temporarily unavailable while indexes are prepared.'
          : 'Templates are temporarily unavailable.',
        code: isMissingIndex ? 'INDEX_REQUIRED' : 'TEMPLATES_UNAVAILABLE',
      }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      templates,
      count: templates.length,
    }, { headers });
  } catch (error) {
    console.error('[Templates API] Error fetching templates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch templates', templates: [] },
      { status: 500 }
    );
  }
}

async function ownedTemplatePage(uid: string, searchParams: URLSearchParams) {
  const timer = createServerTimer();
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 24, 1), 48);
  const db = getAdminFirestore();
  const toCard = (id: string, data: FirebaseFirestore.DocumentData) => ({
    id: data.id || id,
    name: data.name || 'Untitled template',
    thumbnail: data.thumbnail || null,
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
    certificateCount: data.certificateCount || 0,
    isPublic: data.isPublic === true,
    stars: data.stars || 0,
    tags: Array.isArray(data.tags) ? data.tags : [],
    category: data.category || null,
    publicationStatus: data.publicationStatus || (data.isPublic ? 'public' : 'private'),
    canvasJSON: '',
  });

  try {
    const page = await timer.measure('list', getOwnerPage(db, 'templates', uid, {
      field: 'updatedAt',
      limit,
      cursor: searchParams.get('cursor'),
      select: TEMPLATE_CARD_FIELDS,
    }));
    // The last page carries the exact count. Records without an updatedAt
    // never appear in an ordered query; a client that loaded fewer than this
    // asks for the complete list instead.
    const totalCount = page.nextCursor
      ? undefined
      : await timer.measure('count', db.collection('templates').where('userId', '==', uid).count().get()).then((snapshot) => snapshot.data().count);
    const templates = page.docs.map((document) => toCard(document.id, document.data()));
    return NextResponse.json({
      success: true,
      templates,
      count: templates.length,
      nextCursor: page.nextCursor,
      hasMore: !!page.nextCursor,
      ...(totalCount !== undefined ? { totalCount } : {}),
    }, { headers: { 'Cache-Control': 'private, no-store', 'Server-Timing': timer.header() } });
  } catch (error) {
    if ((error as { code?: unknown })?.code === 'INVALID_CURSOR') {
      return NextResponse.json({ success: false, error: 'Invalid cursor', code: 'INVALID_CURSOR' }, { status: 400 });
    }
    if (!isMissingIndexError(error)) throw error;
    // Index not ready: the complete list, exactly as older releases read it.
    const templates = (await getUserTemplates(uid)).map((template) => toCard(template.id, template));
    return NextResponse.json({
      success: true, templates, count: templates.length, nextCursor: null, hasMore: false, totalCount: templates.length,
    }, { headers: { 'Cache-Control': 'private, no-store', 'Server-Timing': timer.header() } });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const {
      name,
      canvasJSON,
      thumbnail,
      userId,
      isPublic,
      creatorName,
      creatorEmail,
      tags,
      certificateMetadata,
      category,
    } = body;

    const mismatch = rejectMismatchedUserId(userId, authUser.uid);
    if (mismatch) return mismatch;

    const linkedEventError = await validateLinkedEvent(certificateMetadata, authUser.uid);
    if (linkedEventError) {
      return NextResponse.json({ success: false, error: linkedEventError }, { status: 400 });
    }

    if (!name || !canvasJSON) {
      return NextResponse.json(
        { success: false, error: 'Name and canvasJSON are required' },
        { status: 400 }
      );
    }

    const invariantResult = validateTemplateInvariants(canvasJSON);
    if (!invariantResult.valid) {
      return NextResponse.json({
        success: false,
        error: invariantResult.errors.join(' '),
        code: 'TEMPLATE_INVARIANT_FAILED',
      }, { status: 400 });
    }

    const usesEmulators = process.env.USE_FIREBASE_EMULATORS === 'true';
    if (!usesEmulators && (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !process.env.FIREBASE_ADMIN_PRIVATE_KEY)) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error: Firebase Admin not configured. Please set FIREBASE_ADMIN_* environment variables.' },
        { status: 500 }
      );
    }

    const duplicateName = await findTemplateByNormalizedName(authUser.uid, name);
    if (duplicateName) {
      return NextResponse.json(
        { success: false, error: `A template named "${name}" already exists. Please choose a different name.`, code: 'DUPLICATE_NAME' },
        { status: 400 }
      );
    }

    const publicationV2 = process.env.PUBLIC_TEMPLATE_PUBLISHING_V2 === 'true';
    const template = await createTemplate({
      name,
      canvasJSON,
      thumbnail,
      userId: authUser.uid,
      isPublic: publicationV2 ? false : (isPublic ?? false),
      creatorName,
      creatorEmail: authUser.email || creatorEmail,
      tags: tags || [],
      category,
      certificateMetadata,
    });

    if (publicationV2 && isPublic === true) {
      template.publicationStatus = 'pending_review';
      template.publicationRequestedAt = new Date().toISOString();
      await updateTemplate(template.id, {
        publicationStatus: 'pending_review',
        publicationRequestedAt: template.publicationRequestedAt,
      });
    }

    if (affectsPublicGallery(template)) invalidatePublicTemplates();

    return NextResponse.json({
      success: true,
      template,
    }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create template';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
