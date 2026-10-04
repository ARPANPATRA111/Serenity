import { NextRequest } from 'next/server';
import { handleConsoleRequest } from '@/lib/admin/handler';
import { listEmailLog } from '@/lib/admin/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleConsoleRequest(request, async ({ meter }) => {
    const params = request.nextUrl.searchParams;
    return listEmailLog({ cursor: params.get('cursor'), limit: Number(params.get('limit')) || 50 }, meter);
  });
}
