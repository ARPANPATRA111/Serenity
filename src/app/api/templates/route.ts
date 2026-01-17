import { NextRequest, NextResponse } from 'next/server';
import {
  createTemplate,
  getUserTemplates,
  getPublicTemplates,
  searchTemplates,
  type Template,
} from '@/lib/firebase/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory cache for public templates (refreshes every 60 seconds)
let publicTemplatesCache: { templates: Template[]; timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 60 seconds

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const isPublic = searchParams.get('public') === 'true';
    const searchQuery = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let templates: Template[] = [];

    try {
      if (searchQuery) {
        // Search templates
        templates = await searchTemplates(searchQuery, isPublic);
      } else if (userId && !isPublic) {
        // Get user's own templates
        templates = await getUserTemplates(userId);
      } else if (isPublic) {
        // Get public templates with caching
        const now = Date.now();
        if (publicTemplatesCache && (now - publicTemplatesCache.timestamp) < CACHE_TTL) {
          // Use cached data
          templates = publicTemplatesCache.templates.slice(0, limit);
        } else {
          // Fetch fresh data
          templates = await getPublicTemplates(limit);
          publicTemplatesCache = { templates, timestamp: now };
        }
      } else {
        templates = await getPublicTemplates(limit);
      }
    } catch {
      // Return empty array on database errors (Firebase might not be configured)
      templates = [];
    }

    // Add cache headers for public templates
    const headers: HeadersInit = {};
    if (isPublic && !searchQuery) {
      headers['Cache-Control'] = 'public, s-maxage=60, stale-while-revalidate=120';
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
    const body = await request.json();
    
    const { name, canvasJSON, thumbnail, userId, isPublic, creatorName, creatorEmail, tags, certificateMetadata } = body;

    if (!name || !canvasJSON) {
      return NextResponse.json(
        { success: false, error: 'Name and canvasJSON are required' },
        { status: 400 }
      );
    }

    // Check if Firebase Admin is configured
    if (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_CLIENT_EMAIL || !process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error: Firebase Admin not configured. Please set FIREBASE_ADMIN_* environment variables.' },
        { status: 500 }
      );
    }

    const template = await createTemplate({
      name,
      canvasJSON,
      thumbnail,
      userId,
      isPublic: isPublic ?? false,
      creatorName,
      creatorEmail,
      tags: tags || [],
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
