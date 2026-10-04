import { afterEach, describe, expect, test, vi } from 'vitest';
import { isSafeCertificateMediaUrl } from '../src/lib/security/mediaUrl';

const originalHosts = process.env.CERTIFICATE_MEDIA_HOSTS;

afterEach(() => {
  vi.unstubAllEnvs();
  process.env.CERTIFICATE_MEDIA_HOSTS = originalHosts;
});

describe('certificate media URL policy', () => {
  test('allows Vercel Blob and explicit media hosts', () => {
    process.env.CERTIFICATE_MEDIA_HOSTS = 'cdn.example.test';
    expect(isSafeCertificateMediaUrl('https://asset.public.blob.vercel-storage.com/cert.png')).toBe(true);
    expect(isSafeCertificateMediaUrl('https://cdn.example.test/cert.png')).toBe(true);
  });

  test('rejects non-HTTPS and untrusted production hosts', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isSafeCertificateMediaUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isSafeCertificateMediaUrl('https://untrusted.example.test/cert.png')).toBe(false);
  });
});
