import { NextRequest } from 'next/server';
import { ConsoleInputError, handleConsoleRequest } from '@/lib/admin/handler';
import { getUserDetail } from '@/lib/admin/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { uid: string } }) {
  return handleConsoleRequest(request, async ({ meter }) => {
    if (!/^[^/]{1,128}$/.test(params.uid || '')) throw new ConsoleInputError('Invalid user ID');
    const detail = await getUserDetail(params.uid, meter);
    if (!detail) throw new ConsoleInputError('User not found', 404);
    return { detail };
  });
}
