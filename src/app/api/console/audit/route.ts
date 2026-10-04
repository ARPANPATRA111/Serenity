import { NextRequest } from 'next/server';
import { handleConsoleRequest } from '@/lib/admin/handler';
import { listAudit } from '@/lib/admin/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleConsoleRequest(request, async ({ meter }) => ({ entries: await listAudit(meter) }));
}
