/**
 * Certificate Editor Page
 * 
 * /editor
 * 
 * Main application page with the Fabric.js canvas editor.
 * Protected route - requires authentication (handled by AuthContext).
 */

'use client';

import dynamic from 'next/dynamic';
import { FabricProvider } from '@/components/editor/FabricContext';
import { useAuth, AuthLoading } from '@/contexts/AuthContext';

// Dynamically import EditorLayout with SSR disabled
// Fabric.js requires browser APIs and cannot be pre-rendered
const EditorLayout = dynamic(
  () => import('@/components/editor/EditorLayout').then(mod => ({ default: mod.EditorLayout })),
  { 
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading editor...</p>
        </div>
      </div>
    ),
  }
);

export default function EditorPage() {
  const { user, isLoading } = useAuth();

  // Show loading state while checking auth
  // AuthContext handles redirect to login if not authenticated
  if (isLoading) {
    return <AuthLoading />;
  }

  // Don't render editor if not authenticated (should redirect via AuthContext)
  if (!user) {
    return <AuthLoading />;
  }

  return (
    <FabricProvider>
      <EditorLayout />
    </FabricProvider>
  );
}
