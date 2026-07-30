import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from './admin';

export interface VerifiedUser {
  uid: string;
  email?: string;
  emailVerified: boolean;
}

export class AuthError extends Error {
  status: number;

  constructor(message = 'Unauthorized', status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/**
 * Verify a Firebase ID token from the `Authorization: Bearer <token>` header.
 *
 * Returns the trusted user on success, or null if the header is missing/invalid
 * or the token fails verification. Callers MUST derive identity from the
 * returned `uid`, never from a client-supplied userId in the body/query/header.
 */
export async function verifyAuth(request: NextRequest): Promise<VerifiedUser | null> {
  const header =
    request.headers.get('authorization') || request.headers.get('Authorization');

  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return null;
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified === true,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(request: NextRequest): Promise<VerifiedUser> {
  const user = await verifyAuth(request);
  if (!user) {
    throw new AuthError('Unauthorized', 401);
  }
  return user;
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json(
    { success: false, error: message },
    { status: 401 }
  );
}

export function forbiddenResponse(message = 'Forbidden') {
  return NextResponse.json(
    { success: false, error: message },
    { status: 403 }
  );
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status }
    );
  }

  return NextResponse.json(
    { success: false, error: 'Unauthorized' },
    { status: 401 }
  );
}
