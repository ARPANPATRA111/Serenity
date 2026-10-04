function configuredHosts(): Set<string> {
  const hosts = new Set(
    (process.env.CERTIFICATE_MEDIA_HOSTS || '')
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean),
  );

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
    if (siteUrl) hosts.add(new URL(siteUrl).hostname.toLowerCase());
  } catch {
    // Invalid site configuration is handled by the URL builder/configuration gate.
  }

  return hosts;
}

export function isSafeCertificateMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const emulatorMode = process.env.USE_FIREBASE_EMULATORS === 'true';
  const localMode = process.env.NODE_ENV !== 'production' || emulatorMode;

  if (localMode && ['localhost', '127.0.0.1', '0.0.0.0'].includes(host)) {
    return ['http:', 'https:'].includes(parsed.protocol);
  }

  if (parsed.protocol !== 'https:') return false;
  if (host.endsWith('.public.blob.vercel-storage.com')) return true;

  return configuredHosts().has(host);
}
