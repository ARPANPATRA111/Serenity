import { NextRequest, NextResponse } from 'next/server';
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
  saveOrUpdateTemplate,
  getUserTemplates,
  type Template,
} from '@/lib/firebase/templates';
import { forbiddenResponse, unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function rejectMismatchedUserId(clientUserId: unknown, uid: string) {
  if (clientUserId && typeof clientUserId === 'string' && clientUserId !== uid) {
    return forbiddenResponse('Authenticated user does not match requested user ID');
  }

  return null;
}

function sanitizePublicTemplate(template: Template): Template {
  const { creatorEmail, userId, ...safeTemplate } = template;
  return safeTemplate as Template;
}

async function rejectIfDuplicateName(name: string | undefined, userId: string, currentId: string) {
  if (!name) return null;

  const existingTemplates = await getUserTemplates(userId);
  const duplicateName = existingTemplates.find(
    t => t.id !== currentId && t.name.toLowerCase().trim() === name.toLowerCase().trim()
  );

  if (!duplicateName) return null;

  return NextResponse.json(
    { success: false, error: `A template named "${name}" already exists. Please choose a different name.` },
    { status: 400 }
  );
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const template = await getTemplate(id);

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    const authUser = await verifyAuth(request);
    const isOwner = !!authUser && template.userId === authUser.uid;

    if (!template.isPublic && !isOwner) {
      return authUser ? forbiddenResponse('Forbidden') : unauthorizedResponse();
    }

    return NextResponse.json({
      success: true,
      template: isOwner ? template : sanitizePublicTemplate(template),
    });
  } catch (error) {
    console.error('[Template API] Error fetching template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      canvasJSON,
      thumbnail,
      isPublic,
      tags,
      userId,
      creatorName,
      creatorEmail,
      createIfNotExists,
      certificateMetadata,
      category,
    } = body;

    const mismatch = rejectMismatchedUserId(userId, authUser.uid);
    if (mismatch) return mismatch;

    const existing = await getTemplate(id);
    if (existing && existing.userId !== authUser.uid) {
      return forbiddenResponse('Forbidden');
    }

    const duplicate = await rejectIfDuplicateName(name, authUser.uid, id);
    if (duplicate) return duplicate;

    if (createIfNotExists) {
      const template = await saveOrUpdateTemplate({
        existingId: id,
        name: name || 'Untitled Template',
        canvasJSON,
        thumbnail,
        userId: authUser.uid,
        isPublic,
        creatorName,
        creatorEmail: authUser.email || creatorEmail,
        tags,
        category,
        certificateMetadata,
      });

      return NextResponse.json({
        success: true,
        template,
        created: template.id !== id,
      });
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (canvasJSON !== undefined) updates.canvasJSON = canvasJSON;
    if (thumbnail !== undefined) updates.thumbnail = thumbnail;
    if (typeof isPublic === 'boolean') updates.isPublic = isPublic;
    if (tags !== undefined) updates.tags = tags;
    if (category !== undefined) updates.category = category;
    if (certificateMetadata !== undefined) updates.certificateMetadata = certificateMetadata;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const template = await updateTemplate(id, updates);

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('[Template API] Error updating template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Failed to update template: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const template = await getTemplate(id);

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    if (template.userId !== authUser.uid) {
      return forbiddenResponse('Forbidden');
    }

    const success = await deleteTemplate(id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('[Template API] Error deleting template:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
