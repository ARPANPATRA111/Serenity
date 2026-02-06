'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { initializeFirebase, type FirebaseConfig } from '@/lib/firebase/client';

interface FirebaseProviderProps {
  config: FirebaseConfig;
  children: ReactNode;
}

export function FirebaseProvider({ config, children }: FirebaseProviderProps) {
  const initialized = useRef(false);

  if (!initialized.current) {
    initializeFirebase(config);
    initialized.current = true;
  }

  return <>{children}</>;
}
