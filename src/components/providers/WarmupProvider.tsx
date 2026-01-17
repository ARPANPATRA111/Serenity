'use client';

import { useEffect } from 'react';

export function WarmupProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const warmup = async () => {
      try {
        await fetch('/api/warmup', { 
          method: 'GET',
          priority: 'low' as RequestPriority,
        });
      } catch {
      }
    };

    const timer = setTimeout(warmup, 100);
    return () => clearTimeout(timer);
  }, []);

  return <>{children}</>;
}
