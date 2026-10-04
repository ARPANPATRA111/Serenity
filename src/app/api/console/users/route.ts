import { NextRequest } from 'next/server';
import { handleConsoleRequest } from '@/lib/admin/handler';
import { listUsers, type UserSort } from '@/lib/admin/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SORTS = new Set<UserSort>(['newest', 'active', 'creators', 'premium']);

export async function GET(request: NextRequest) {
  return handleConsoleRequest(request, async ({ meter }) => {
    const params = request.nextUrl.searchParams;
    const requested = params.get('sort') as UserSort | null;
    const sort: UserSort = requested && SORTS.has(requested) ? requested : 'newest';
    const page = await listUsers({
      sort,
      cursor: params.get('cursor'),
      search: params.get('q'),
      limit: Number(params.get('limit')) || 25,
    }, meter);
    return { ...page, sort };
  });
}
