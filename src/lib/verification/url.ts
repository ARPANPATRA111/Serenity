export function buildVerificationUrl(certificateId: string, siteUrl?: string): string {
  if (!certificateId || certificateId.includes('/') || certificateId.includes('\\')) {
    throw new Error('A valid certificate ID is required to build a verification URL');
  }

  const configuredUrl = siteUrl || process.env.NEXT_PUBLIC_SITE_URL;
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
  const isLocalMode = process.env.NODE_ENV !== 'production' || process.env.USE_FIREBASE_EMULATORS === 'true';
  const baseUrl = configuredUrl || browserOrigin || (isLocalMode ? 'http://localhost:3000' : undefined);

  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_SITE_URL is required for verification links');
  }

  const url = new URL(baseUrl);
  url.pathname = `/verify/${encodeURIComponent(certificateId)}`;
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}
