import { NextRequest, NextResponse } from 'next/server';
import { createEvent, listUserEvents } from '@/lib/firebase/events';
import { parseEventInput } from '@/lib/events/validation';
import { unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) return unauthorizedResponse();

    const requestedLimit = Number.parseInt(new URL(request.url).searchParams.get('limit') || '50', 10);
    const events = await listUserEvents(authUser.uid, Math.min(Math.max(requestedLimit, 1), 100));
    return NextResponse.json({ success: true, events }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('[Events API] Failed to list events:', error);
    return NextResponse.json({ success: false, error: 'Events are temporarily unavailable.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) return unauthorizedResponse();

    const parsed = parseEventInput(await request.json());
    if (!parsed.event) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }

    const event = await createEvent(authUser.uid, parsed.event);
    return NextResponse.json({ success: true, event }, { status: 201 });
  } catch (error) {
    console.error('[Events API] Failed to create event:', error);
    return NextResponse.json({ success: false, error: 'Failed to create event.' }, { status: 500 });
  }
}
