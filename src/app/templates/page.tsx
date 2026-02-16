'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ArrowLeft, Star, Award, Search, X, SlidersHorizontal } from 'lucide-react';
import { TemplateCard } from '@/components/templates/TemplateCard';

interface Template {
  id: string;
  name: string;
  canvasJSON: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  certificateCount: number;
  userId?: string;
  isPublic: boolean;
  creatorName?: string;
  stars: number;
  tags?: string[];
  category?: string;
}

const CATEGORIES = [
  'All',
  'Education',
  'Corporate',
  'Achievement',
  'Participation',
  'Workshop',
  'Course',
  'Event',
  'Other',
];

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

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'stars' | 'updated' | 'name'>('stars');

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await fetch('/api/templates?public=true&limit=100');
        const data = await res.json();
        if (data.success && data.templates) {
          setTemplates(data.templates);
        }
      } catch (error) {
        console.error('Failed to fetch templates:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.creatorName && t.creatorName.toLowerCase().includes(q)) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q))) ||
        (t.category && t.category.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(t =>
        t.category === selectedCategory ||
        (t.tags && t.tags.some(tag => tag.toLowerCase() === selectedCategory.toLowerCase()))
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'stars':
          return b.stars - a.stars;
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [templates, searchQuery, selectedCategory, sortBy]);

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

        {/* Search & Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates by name, creator, or tag..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="stars">Most Popular</option>
              <option value="updated">Recently Updated</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        {loading ? (
          <LoadingGrid />
        ) : filteredTemplates.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Star className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold">
              {templates.length === 0 ? 'No Public Templates Yet' : 'No Matching Templates'}
            </h3>
            <p className="mt-2 text-muted-foreground">
              {templates.length === 0
                ? 'Be the first to share a template with the community!'
                : 'Try adjusting your search or category filter.'}
            </p>
            {templates.length === 0 && (
              <Link href="/editor" className="btn-primary mt-4 inline-flex">
                Create & Share Template
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Showing {filteredTemplates.length} of {templates.length} templates
              {selectedCategory !== 'All' && ` in ${selectedCategory}`}
              {searchQuery && ` matching "${searchQuery}"`}
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <TemplateCard key={template.id} template={template as any} />
              ))}
            </div>
          </>
        )}

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
