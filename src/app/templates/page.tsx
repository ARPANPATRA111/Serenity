import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ArrowLeft, Star, Award } from 'lucide-react';
import { getPublicTemplates, type Template } from '@/lib/firebase/templates';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { Suspense } from 'react';

// Force dynamic rendering for real-time data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getTemplates(): Promise<Template[]> {
  try {
    return await getPublicTemplates(50);
  } catch (error) {
    console.error('[Templates Page] Error fetching templates:', error);
    return [];
  }
}

function TemplatesGrid({ templates }: { templates: Template[] }) {
  if (templates.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Star className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-display text-lg font-semibold">No Public Templates Yet</h3>
        <p className="mt-2 text-muted-foreground">
          Be the first to share a template with the community!
        </p>
        <Link href="/editor" className="btn-primary mt-4 inline-flex">
          Create & Share Template
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card animate-pulse overflow-hidden">
          <div className="mb-4 h-40 rounded-lg bg-muted" />
          <div className="space-y-3">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-6 w-3/4 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-10 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function TemplatesPage() {
  const templates = await getTemplates();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
              <Award className="h-4 w-4 text-white" />
            </div>
            <span className="font-display text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Serenity</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/editor" className="btn-primary">
              Open Editor
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold">Public Templates</h1>
              <p className="mt-1 text-muted-foreground">
                Browse templates shared by the community
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="h-4 w-4 text-yellow-500" />
              <span>{templates.length} templates</span>
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        <Suspense fallback={<LoadingGrid />}>
          <TemplatesGrid templates={templates} />
        </Suspense>

        {/* Create Custom */}
        <div className="mt-12 rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 p-8 text-center">
          <h2 className="font-display text-2xl font-bold">
            Share Your Creations
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Create your own certificate template and share it with the community.
            Your name will be displayed alongside your template.
          </p>
          <Link href="/editor" className="btn-primary mt-6 inline-flex">
            Create & Share Template
          </Link>
        </div>
      </main>
    </div>
  );
}
