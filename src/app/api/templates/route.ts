import { NextRequest, NextResponse } from 'next/server';
import {
  createTemplate,
  getUserTemplates,
  getPublicTemplates,
  searchTemplates,
  type Template,
} from '@/lib/firebase/templates';
import { forbiddenResponse, unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';

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
        } else {
          const now = Date.now();
          if (publicTemplatesCache && (now - publicTemplatesCache.timestamp) < CACHE_TTL) {
            templates = publicTemplatesCache.templates.slice(0, limit);
          } else {
            templates = await getPublicTemplates(limit);
            templates = templates.map(template => sanitizePublicTemplate(template));
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
    } catch {
      // Return empty array on database errors (Firebase might not be configured)
      templates = [];
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

    if (!name || !canvasJSON) {
      return NextResponse.json(
        { success: false, error: 'Name and canvasJSON are required' },
        { status: 400 }
      );
    }

    if (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error: Firebase Admin not configured. Please set FIREBASE_ADMIN_* environment variables.' },
        { status: 500 }
      );
    }

    const existingTemplates = await getUserTemplates(authUser.uid);
    const duplicateName = existingTemplates.find(
      t => t.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (duplicateName) {
      return NextResponse.json(
        { success: false, error: `A template named "${name}" already exists. Please choose a different name.` },
        { status: 400 }
      );
    }

    const template = await createTemplate({
      name,
      canvasJSON,
      thumbnail,
      userId: authUser.uid,
      isPublic: isPublic ?? false,
      creatorName,
      creatorEmail: authUser.email || creatorEmail,
      tags: tags || [],
      category,
      certificateMetadata,
    });

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
