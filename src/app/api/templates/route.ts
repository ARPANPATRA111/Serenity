import { NextRequest, NextResponse } from 'next/server';
import {
  createTemplate,
  getUserTemplates,
  getPublicTemplates,
  searchTemplates,
  findTemplateByNormalizedName,
  updateTemplate,
  type Template,
} from '@/lib/firebase/templates';
import { forbiddenResponse, unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';
import { validateTemplateInvariants } from '@/lib/fabric/templateInvariants';
import { getEvent } from '@/lib/firebase/events';
import {
  mergeWithCuratedTemplates,
  searchCuratedTemplates,
} from '@/lib/templates/curatedPublicTemplates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory cache for public templates (refreshes every 60 seconds)
let publicTemplatesCache: { templates: Template[]; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 60 seconds

function rejectMismatchedUserId(clientUserId: unknown, uid: string) {
  if (clientUserId && typeof clientUserId === 'string' && clientUserId !== uid) {
    return forbiddenResponse('Authenticated user does not match requested user ID');
  }

  return null;
}

function sanitizePublicTemplate(template: Template, includeCanvasJSON = false): Template {
  const { creatorEmail, userId, canvasJSON, ...safeTemplate } = template;
  return {
    ...safeTemplate,
    canvasJSON: includeCanvasJSON ? canvasJSON : '',
  } as Template;
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
          const now = Date.now();
          if (publicTemplatesCache && (now - publicTemplatesCache.timestamp) < CACHE_TTL) {
            templates = publicTemplatesCache.templates.slice(0, limit);
          } else {
            templates = await getPublicTemplates(limit);
            templates = mergeWithCuratedTemplates(
              templates.map(template => sanitizePublicTemplate(template)),
              limit,
            ).map(template => sanitizePublicTemplate(template));
            publicTemplatesCache = { templates, timestamp: now };
          }
          headers['Cache-Control'] = 'public, s-maxage=60, stale-while-revalidate=120';
        }
      } else {
        const authUser = await verifyAuth(request);
        if (!authUser) {
          return unauthorizedResponse();
        }

        const mismatch = rejectMismatchedUserId(userId, authUser.uid);
        if (mismatch) return mismatch;

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
        { success: false, error: `A template named "${name}" already exists. Please choose a different name.` },
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
