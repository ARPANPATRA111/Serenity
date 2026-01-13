'use client';

/**
 * FabricContext - Provides Fabric.js instance to child components
 * 
 * Allows toolbar and sidebars to access canvas methods without prop drilling.
 * Uses useCallback to prevent infinite re-renders when setFabricInstance is used in useEffect.
 */

import { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import type { UseFabricReturn } from '@/lib/fabric';

interface FabricContextValue {
  fabricInstance: UseFabricReturn | null;
  setFabricInstance: (instance: UseFabricReturn | null) => void;
}

const FabricContext = createContext<FabricContextValue | null>(null);

export function FabricProvider({ children }: { children: ReactNode }) {
  const [fabricInstance, setFabricInstanceState] = useState<UseFabricReturn | null>(null);
  const instanceRef = useRef<UseFabricReturn | null>(null);

  // Memoize setFabricInstance to prevent infinite re-renders
  const setFabricInstance = useCallback((instance: UseFabricReturn | null) => {
    // Only update if the instance actually changed
    if (instanceRef.current !== instance) {
      instanceRef.current = instance;
      setFabricInstanceState(instance);
    }
  }, []);

  return (
    <FabricContext.Provider value={{ fabricInstance, setFabricInstance }}>
      {children}
    </FabricContext.Provider>
  );
}

export function useFabricContext(): FabricContextValue {
  const context = useContext(FabricContext);
  if (!context) {
    throw new Error('useFabricContext must be used within a FabricProvider');
  }
  return context;
}
