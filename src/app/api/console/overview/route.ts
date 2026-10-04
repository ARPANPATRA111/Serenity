import { NextRequest } from 'next/server';
import { handleConsoleRequest } from '@/lib/admin/handler';
import { getOverview } from '@/lib/admin/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleConsoleRequest(request, async ({ meter }) => {
    const refresh = request.nextUrl.searchParams.get('refresh') === '1';
    const { data, cached } = await getOverview({ refresh });
    // A cached overview costs nothing; a fresh one costs what it measured.
    if (!cached) meter.document(data.estimatedReads);
    return { overview: data, cached };
  });
}
