const ALLOWED_AUTH_REDIRECTS = [
  '/dashboard',
  '/editor',
  '/history',
  '/templates',
  '/my-templates',
  '/settings',
] as const;

export function sanitizeAuthRedirect(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/dashboard';
  }

  try {
    const base = new URL('https://serenity.local');
    const candidate = new URL(value, base);
    const isAllowed = ALLOWED_AUTH_REDIRECTS.some((path) => (
      candidate.pathname === path || candidate.pathname.startsWith(`${path}/`)
    ));

    if (candidate.origin !== base.origin || !isAllowed) {
      return '/dashboard';
    }

    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return '/dashboard';
  }
}

export function authPageHref(path: '/login' | '/signup', redirect: string | null, verificationSent = false) {
  const params = new URLSearchParams();
  if (verificationSent) params.set('message', 'verification-sent');
  if (redirect) params.set('redirect', sanitizeAuthRedirect(redirect));
  const query = params.toString();
  return query ? path + '?' + query : path;
}
