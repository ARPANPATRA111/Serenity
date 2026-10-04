import { NextRequest } from 'next/server';
import { handleConsoleRequest } from '@/lib/admin/handler';
import { listCertificates } from '@/lib/admin/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleConsoleRequest(request, async ({ meter }) => {
    const params = request.nextUrl.searchParams;
    return listCertificates({
      cursor: params.get('cursor'),
      ownerUid: params.get('owner'),
      limit: Number(params.get('limit')) || 24,
    }, meter);
  });
}
