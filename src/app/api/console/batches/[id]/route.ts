import { NextRequest } from 'next/server';
import { ConsoleInputError, handleConsoleRequest } from '@/lib/admin/handler';
import { getBatchRecipients } from '@/lib/admin/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return handleConsoleRequest(request, async ({ meter }) => {
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(params.id || '')) throw new ConsoleInputError('Invalid batch ID');
    return getBatchRecipients(params.id, meter);
  });
}
