import { NextRequest, NextResponse } from 'next/server';
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
  saveOrUpdateTemplate,
} from '@/lib/firebase/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    console.log('[Template API] GET template:', id);

    const template = await getTemplate(id);

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      template,
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
    const { id } = await params;
    const body = await request.json();
    
    const { name, canvasJSON, thumbnail, isPublic, tags, userId, creatorName, creatorEmail, createIfNotExists, certificateMetadata } = body;

    console.log('[Template API] PUT template:', { id, name, isPublic, createIfNotExists });

    // If createIfNotExists is true, use saveOrUpdateTemplate
    if (createIfNotExists) {
      const template = await saveOrUpdateTemplate({
        existingId: id,
        name: name || 'Untitled Template',
        canvasJSON,
        thumbnail,
        userId,
        isPublic,
        creatorName,
        creatorEmail,
        tags,
        certificateMetadata,
      });

      return NextResponse.json({
        success: true,
        template,
        created: template.id !== id,
      });
    }

    // Otherwise, just update existing
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (canvasJSON !== undefined) updates.canvasJSON = canvasJSON;
    if (thumbnail !== undefined) updates.thumbnail = thumbnail;
    if (typeof isPublic === 'boolean') updates.isPublic = isPublic;
    if (tags !== undefined) updates.tags = tags;
    if (certificateMetadata !== undefined) updates.certificateMetadata = certificateMetadata;

    // Ensure we have at least one field to update
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const template = await updateTemplate(id, updates);

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    console.log('[Template API] Template updated:', id);

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
    const { id } = await params;
    
    console.log('[Template API] DELETE template:', id);

    const success = await deleteTemplate(id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    console.log('[Template API] Template deleted:', id);

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
