'use client';

import { useEffect } from 'react';

/**
 * Records one view per browser session after the verification page renders.
 * Crawlers that do not run JavaScript never count, and a counting failure can
 * never affect the page.
 */
export function ViewBeacon({ certificateId }: { certificateId: string }) {
  useEffect(() => {
    const key = `serenity:viewed:${certificateId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Storage can be unavailable (private mode); count at most once per load.
    }

    const url = `/api/verify/${encodeURIComponent(certificateId)}/view`;
    try {
      if (navigator.sendBeacon?.(url)) return;
    } catch {
      // Fall through to fetch.
    }
    void fetch(url, { method: 'POST', keepalive: true }).catch(() => undefined);
  }, [certificateId]);

  return null;
}
