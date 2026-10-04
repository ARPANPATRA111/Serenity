import { NextRequest } from 'next/server';
import { forbiddenResponse, unauthorizedResponse, verifyAuth } from '@/lib/firebase/verifyAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authUser = await verifyAuth(request);
  if (!authUser) {
    return unauthorizedResponse();
  }

  // Legacy user ID reassignment can move private records across accounts.
  // Full migration must be handled by an admin/support-controlled workflow with
  // explicit identity proofing and audit logs, not by a public client route.
  return forbiddenResponse('User data migration is disabled');
}
