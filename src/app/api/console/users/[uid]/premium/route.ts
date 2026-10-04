import { NextRequest } from 'next/server';
import { ConsoleInputError, handleConsoleRequest } from '@/lib/admin/handler';
import { changePremium, invalidateOverview } from '@/lib/admin/analytics';
import { writeAudit } from '@/lib/admin/audit';
import { getAdminAuth } from '@/lib/firebase/admin';
import { clientFromHeaders } from '@/lib/verification/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PLAN_LENGTH_MS = 5 * 366 * 86_400_000;

/**
 * Grants or revokes Serenity Pro for one account. Every change is recorded in
 * the console audit log with the plan state before and after.
 */
export async function POST(request: NextRequest, { params }: { params: { uid: string } }) {
  return handleConsoleRequest(request, async ({ identity, meter }) => {
    const uid = params.uid;
    if (!/^[^/]{1,128}$/.test(uid || '')) throw new ConsoleInputError('Invalid user ID');

    const body = await request.json().catch(() => null) as { action?: unknown; until?: unknown; note?: unknown } | null;
    const action = body?.action;
    if (action !== 'grant' && action !== 'revoke') throw new ConsoleInputError('Action must be "grant" or "revoke"');

    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : '';

    let until: string | null = null;
    if (action === 'grant' && body?.until !== null && body?.until !== undefined && body?.until !== '') {
      const parsed = typeof body.until === 'string' ? Date.parse(body.until) : Number.NaN;
      if (Number.isNaN(parsed)) throw new ConsoleInputError('The end date is not a valid date');
      if (parsed <= Date.now()) throw new ConsoleInputError('The end date must be in the future');
      if (parsed - Date.now() > MAX_PLAN_LENGTH_MS) throw new ConsoleInputError('The end date must be within five years');
      until = new Date(parsed).toISOString();
    }

    // Plans are only attached to real accounts.
    try {
      await getAdminAuth().getUser(uid);
    } catch {
      throw new ConsoleInputError('No account exists with this user ID', 404);
    }

    const result = await changePremium({
      uid,
      action,
      until,
      note,
      actorEmail: identity.email,
      actorUid: identity.uid,
    });
    meter.document();

    await writeAudit({
      action: action === 'grant' ? 'premium.granted' : 'premium.revoked',
      actorUid: identity.uid,
      actorEmail: identity.email,
      target: uid,
      details: { before: result.before, after: result.after, note },
      client: clientFromHeaders(request.headers),
    });
    invalidateOverview();

    return { premium: result.after };
  }, { enforceBudget: false });
}
