import { NextRequest } from 'next/server';
import { handleConsoleRequest } from '@/lib/admin/handler';
import { listBatches } from '@/lib/admin/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleConsoleRequest(request, async ({ meter }) => {
    const params = request.nextUrl.searchParams;
    return listBatches({ cursor: params.get('cursor'), limit: Number(params.get('limit')) || 20 }, meter);
  });
}
