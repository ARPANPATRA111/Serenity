'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth, AuthLoading } from '@/contexts/AuthContext';
import { 
  ArrowLeft, Plus, Search, Filter, Star, Award, Globe, Lock, 
  MoreVertical, Edit3, Trash2, Eye, Clock, FileText, Crown,
  X, Tag, Sparkles
} from 'lucide-react';

interface UserTemplate {
  id: string;
  name: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  certificateCount: number;
  isPublic: boolean;
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

export default function MyTemplatesPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'name' | 'stars'>('updated');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchTemplates = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/templates?userId=${user.id}`);
      const data = await res.json();
      if (data.success && data.templates) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchTemplates();
    }
  }, [user?.id, fetchTemplates]);

  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(q) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q)))
      );
    }

    // Category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(t => 
        t.category === selectedCategory || 
        (t.tags && t.tags.some(tag => tag.toLowerCase() === selectedCategory.toLowerCase()))
      );
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'stars':
          return b.stars - a.stars;
        default:
          return 0;
      }
    });

    return filtered;
  }, [templates, searchQuery, selectedCategory, sortBy]);

  const handleDelete = async (templateId: string) => {
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== templateId));
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const handleToggleVisibility = async (templateId: string, currentPublic: boolean) => {
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !currentPublic }),
      });
      if (res.ok) {
        setTemplates(prev => prev.map(t => 
          t.id === templateId ? { ...t, isPublic: !currentPublic } : t
        ));
      }
    } catch (error) {
      console.error('Failed to toggle visibility:', error);
    }
    setActiveMenu(null);
  };

  if (authLoading) return <AuthLoading />;
  if (!isAuthenticated) return null;

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
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold">My Templates</h1>
              <p className="mt-1 text-muted-foreground">
                Manage your certificate templates
              </p>
            </div>
            <Link
              href="/editor"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-md"
            >
              <Plus className="w-4 h-4" />
              New Template
            </Link>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
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
              <option value="updated">Last Modified</option>
              <option value="created">Date Created</option>
              <option value="name">Name (A-Z)</option>
              <option value="stars">Most Stars</option>
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-4 animate-pulse">
                <div className="h-40 rounded-xl bg-muted mb-4" />
                <div className="h-5 w-2/3 rounded bg-muted mb-2" />
                <div className="h-4 w-1/3 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold">
              {templates.length === 0 ? 'No Templates Yet' : 'No Matching Templates'}
            </h3>
            <p className="mt-2 text-muted-foreground max-w-sm mx-auto">
              {templates.length === 0
                ? 'Create your first certificate template to get started!'
                : 'Try adjusting your search or category filter.'}
            </p>
            {templates.length === 0 && (
              <Link href="/editor" className="btn-primary mt-4 inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Create Template
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filteredTemplates.map((template) => (
                <motion.div
                  key={template.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all"
                >
                  {/* Thumbnail */}
                  <div className="relative h-40 bg-muted">
                    {template.thumbnail ? (
                      <Image 
                        src={template.thumbnail} 
                        alt={template.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <FileText className="w-12 h-12 text-muted-foreground/30" />
                      </div>
                    )}
                    
                    {/* Visibility badge */}
                    <div className="absolute top-3 left-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        template.isPublic
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {template.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {template.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>

                    {/* Actions menu */}
                    <div className="absolute top-3 right-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === template.id ? null : template.id);
                        }}
                        className="p-2 rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenu === template.id && (
                        <div className="absolute right-0 top-10 w-48 bg-card rounded-xl shadow-xl border border-border overflow-hidden z-10">
                          <Link
                            href={`/editor?template=${template.id}`}
                            className="flex items-center gap-2 px-4 py-3 hover:bg-muted text-sm text-foreground transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                            Edit Template
                          </Link>
                          <button
                            onClick={() => handleToggleVisibility(template.id, template.isPublic)}
                            className="flex items-center gap-2 px-4 py-3 hover:bg-muted text-sm text-foreground transition-colors w-full text-left"
                          >
                            {template.isPublic ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                            {template.isPublic ? 'Make Private' : 'Make Public'}
                          </button>
                          <button
                            onClick={() => { setDeleteConfirm(template.id); setActiveMenu(null); }}
                            className="flex items-center gap-2 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600 dark:text-red-400 transition-colors w-full text-left"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Hover overlay */}
                    <Link
                      href={`/editor?template=${template.id}`}
                      className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center"
                    >
                      <span className="hidden group-hover:flex items-center gap-2 px-4 py-2 bg-white/90 dark:bg-slate-900/90 text-foreground rounded-lg font-medium text-sm shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit3 className="w-4 h-4" />
                        Open Editor
                      </span>
                    </Link>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-foreground text-sm truncate">{template.name}</h3>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(template.updatedAt).toLocaleDateString()}
                      </span>
                      {template.stars > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-500" />
                          {template.stars}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {template.certificateCount} certs
                      </span>
                    </div>
                    {template.tags && template.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {template.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
                            <Tag className="w-2.5 h-2.5" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Stats summary */}
        {!loading && templates.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <span>{templates.length} total templates</span>
            <span className="hidden sm:inline">•</span>
            <span>{templates.filter(t => t.isPublic).length} public</span>
            <span className="hidden sm:inline">•</span>
            <span>{templates.filter(t => !t.isPublic).length} private</span>
            <span className="hidden sm:inline">•</span>
            <span>{templates.reduce((sum, t) => sum + t.stars, 0)} total stars</span>
          </div>
        )}

        {/* Browse Public Templates CTA */}
        <div className="mt-12 rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 p-8 text-center">
          <h2 className="font-display text-2xl font-bold">
            Discover More Templates
          </h2>
          <p className="mt-2 text-muted-foreground max-w-md mx-auto">
            Browse community-shared templates for inspiration or use them as a starting point.
          </p>
          <Link
            href="/templates"
            className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            <Sparkles className="w-4 h-4" />
            Browse Public Templates
          </Link>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card rounded-2xl border border-border shadow-2xl p-6 max-w-sm w-full"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Delete Template?</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                This action cannot be undone. The template and all associated data will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click outside to close active menu */}
      {activeMenu && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setActiveMenu(null)} 
        />
      )}
    </div>
  );
}
