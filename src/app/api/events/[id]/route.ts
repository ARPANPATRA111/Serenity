import { NextRequest, NextResponse } from 'next/server';
import { archiveEvent, getEvent, updateEvent } from '@/lib/firebase/events';
import { parseEventInput } from '@/lib/events/validation';
import { forbiddenResponse, unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function ownedEvent(request: NextRequest, id: string) {
  const authUser = await verifyAuth(request);
  if (!authUser) return { response: unauthorizedResponse() };
  const event = await getEvent(id);
  if (!event) return { response: NextResponse.json({ success: false, error: 'Event not found.' }, { status: 404 }) };
  if (event.userId !== authUser.uid) return { response: forbiddenResponse('You do not own this event.') };
  return { event };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const result = await ownedEvent(request, id);
  if (result.response) return result.response;
  return NextResponse.json({ success: true, event: result.event }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const result = await ownedEvent(request, id);
    if (result.response) return result.response;
    const parsed = parseEventInput(await request.json());
    if (!parsed.event) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    const event = await updateEvent(id, parsed.event);
    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('[Events API] Failed to update event:', error);
    return NextResponse.json({ success: false, error: 'Failed to update event.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const result = await ownedEvent(request, id);
    if (result.response) return result.response;
    await archiveEvent(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Events API] Failed to archive event:', error);
    return NextResponse.json({ success: false, error: 'Failed to archive event.' }, { status: 500 });
  }
}
