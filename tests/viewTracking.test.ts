import { createHash } from 'node:crypto';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { getViewSaltBase, isAutomatedAgent, viewerHash } from '../src/lib/verification/viewTracking';

describe('isAutomatedAgent', () => {
  test('ignores crawlers and link-preview fetchers', () => {
    for (const agent of [
      'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'WhatsApp/2.23.20.0 A',
      'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
      'TelegramBot (like TwitterBot)',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36',
      'curl/8.4.0',
      'python-requests/2.31.0',
      '',
    ]) {
      expect(isAutomatedAgent(agent), agent).toBe(true);
    }
    expect(isAutomatedAgent(null)).toBe(true);
  });

  test('counts real browsers, including in-app browsers', () => {
    for (const agent of [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]',
    ]) {
      expect(isAutomatedAgent(agent), agent).toBe(false);
    }
  });
});

describe('viewerHash', () => {
  test('uses the same formula as the original route, so same-day repeat detection carries over', () => {
    const now = new Date('2026-09-30T12:00:00Z');
    const legacy = createHash('sha256').update('203.0.113.9-salt-2026-09-30').digest('hex').substring(0, 32);
    expect(viewerHash('203.0.113.9', 'salt', now)).toBe(legacy);
  });

  test('changes daily so viewers are not linkable across days', () => {
    expect(viewerHash('203.0.113.9', 'salt', new Date('2026-09-30T00:00:00Z')))
      .not.toBe(viewerHash('203.0.113.9', 'salt', new Date('2026-10-01T00:00:00Z')));
  });
});

describe('getViewSaltBase', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('prefers DAILY_IP_SALT', () => {
    vi.stubEnv('DAILY_IP_SALT', 'configured');
    expect(getViewSaltBase()).toBe('configured');
  });

  test('in production without DAILY_IP_SALT it derives a salt instead of failing', () => {
    vi.stubEnv('DAILY_IP_SALT', '');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('USE_FIREBASE_EMULATORS', 'false');
    vi.stubEnv('FIREBASE_ADMIN_PRIVATE_KEY', 'secret-key-material');
    const salt = getViewSaltBase();
    expect(salt).toMatch(/^[0-9a-f]{64}$/);
    expect(salt).not.toContain('secret');
  });

  test('in production with no secret at all it disables counting rather than throwing', () => {
    vi.stubEnv('DAILY_IP_SALT', '');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('USE_FIREBASE_EMULATORS', 'false');
    vi.stubEnv('FIREBASE_ADMIN_PRIVATE_KEY', '');
    expect(getViewSaltBase()).toBeNull();
  });
});
