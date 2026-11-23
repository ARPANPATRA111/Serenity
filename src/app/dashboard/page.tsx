'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { HONOURS_ID, HONOURS_NAME, honoursProof } from '@/lib/templates/honoursDesign';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, AuthLoading } from '@/contexts/AuthContext';
import { authenticatedFetch } from '@/lib/api/authFetch';
import { coordinatedJson, readSessionJson, writeSessionJson } from '@/lib/api/requestCoordinator';
import { MAX_TEMPLATE_FILE_BYTES, parseTemplateFile } from '@/lib/fabric/templateSerialization';
import { fetchAccountStats, readCachedAccountStats } from '@/lib/certificates/accountStatsClient';
import { 
  Plus, 
  FileText, 
  Users, 
  Eye, 
  ArrowRight, 
  Upload,
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  MoreVertical,
  Download,
  Trash2,
  Edit3,
  Search,
  Filter,
  User,
  Globe,
  Lock,
  Bookmark,
  Mail,
  MailCheck,
  MailX,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { SkeletonDashboard, Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { GuillocheSeal } from '@/components/brand/GuillocheSeal';
import { EVENTS_ENABLED } from '@/lib/featureFlags';
import { plural } from '@/lib/utils';
import type { CertificateStats } from '@/lib/certificates/stats';
import { SiteNav } from '@/components/marketing/MarketingNav';

// Certificate interface for Firebase data
interface CertificateRecord {
  id: string;
  recipientName: string;
  recipientEmail?: string;
  title: string;
  issuerName: string;
  issuedAt: string;
  templateId?: string;
  templateName?: string;
  isActive: boolean;
  viewCount: number;
  createdAt: string;
  emailStatus?: 'not_sent' | 'sent' | 'failed';
  emailSentAt?: string;
  emailError?: string;
}

// Template interface matching Firebase schema
interface DashboardTemplate {
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
  publicationStatus?: 'private' | 'pending_review' | 'public' | 'rejected';
}

// Flat tints standing in for a template that has no thumbnail yet. Drawn from
// the palette rather than the full Tailwind spectrum, so a grid of them reads
// as one product instead of a colour chart.
const placeholderTints = [
  'bg-primary/15',
  'bg-secondary/15',
  'bg-accent/15',
  'bg-warning/15',
];

const honoursThumbnail = honoursProof('Recipient Name');

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [templateTab, setTemplateTab] = useState<'my' | 'public'>('my');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Real data from API (Firebase)
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [publicTemplates, setPublicTemplates] = useState<DashboardTemplate[]>([]);
  // Exact account totals from the server; null until loaded (or if unavailable).
  const [accountStats, setAccountStats] = useState<CertificateStats | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [certificatesLoading, setCertificatesLoading] = useState(true);
  const [publicTemplatesLoading, setPublicTemplatesLoading] = useState(true);
  const [importLoading, setImportLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryAttempt, setSummaryAttempt] = useState(0);
  const [statsState, setStatsState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  // Fetch bounded private dashboard data in one authenticated request. The
  // lists never wait for the account totals, which load separately below.
  useEffect(() => {
    let cancelled = false;

    async function fetchDashboardSummary() {
      if (!user?.id) {
        setCertificatesLoading(false);
        setTemplatesLoading(false);
        return;
      }
      
      const cacheKey = `dashboard-summary:${user.id}`;
      type DashboardSummary = {
          recentCertificates: CertificateRecord[];
          recentTemplates: DashboardTemplate[];
      };
      const cached = readSessionJson<DashboardSummary>(cacheKey, 5 * 60_000);
      if (cached) {
        setCertificates(cached.recentCertificates || []);
        setTemplates(cached.recentTemplates || []);
        setCertificatesLoading(false);
        setTemplatesLoading(false);
      }

      try {
        const data = await coordinatedJson<DashboardSummary>(
          cacheKey,
          () => authenticatedFetch('/api/dashboard-summary?templateLimit=6&certificateLimit=12&stats=0'),
          15_000,
        );
        if (cancelled) return;
        setCertificates(data.recentCertificates || []);
        setTemplates(data.recentTemplates || []);
        setSummaryError(null);
        writeSessionJson(cacheKey, { recentCertificates: data.recentCertificates, recentTemplates: data.recentTemplates });
      } catch (error) {
        console.error('[Dashboard] Error fetching summary:', error);
        // A failed load must not look like an empty account.
        if (!cancelled && !cached) setSummaryError(error instanceof Error ? error.message : 'Dashboard data is temporarily unavailable.');
      } finally {
        if (!cancelled) {
          setCertificatesLoading(false);
          setTemplatesLoading(false);
        }
      }
    }

    void fetchDashboardSummary();
    return () => { cancelled = true; };
  }, [user?.id, summaryAttempt]);

  // Exact account totals, shared with History. Shown as pending until they
  // arrive; if they cannot be computed the cards fall back to the recent list.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const cachedStats = readCachedAccountStats(user.id);
    if (cachedStats) {
      setAccountStats(cachedStats);
      setStatsState('ready');
    } else {
      setStatsState('loading');
    }
    fetchAccountStats(user.id)
      .then((stats) => {
        if (cancelled) return;
        setAccountStats(stats);
        setStatsState('ready');
      })
      .catch(() => {
        if (!cancelled && !cachedStats) setStatsState('unavailable');
      });
    return () => { cancelled = true; };
  }, [user?.id, summaryAttempt]);

  // Fetch public templates
  useEffect(() => {
    let cancelled = false;
    async function fetchPublicTemplates() {
      const cacheKey = 'public-templates:featured:6';
      const cached = readSessionJson<{ templates: DashboardTemplate[] }>(cacheKey, 10 * 60_000);
      if (cached) {
        setPublicTemplates(cached.templates || []);
        setPublicTemplatesLoading(false);
      }
      try {
        const data = await coordinatedJson<{ templates: DashboardTemplate[] }>(
          cacheKey,
          () => fetch('/api/templates?public=true&limit=6'),
          60_000,
        );
        if (!cancelled) {
          setPublicTemplates(data.templates || []);
          writeSessionJson(cacheKey, data);
        }
      } catch (error) {
        console.error('[Dashboard] Error fetching public templates:', error);
      } finally {
        if (!cancelled) setPublicTemplatesLoading(false);
      }
    }

    void fetchPublicTemplates();
    return () => { cancelled = true; };
  }, []);

  // Handle template deletion via API
  const handleDeleteTemplate = useCallback(async (templateId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        const response = await authenticatedFetch(`/api/templates/${templateId}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          setTemplates(prev => prev.filter(t => t.id !== templateId));
          console.log('[Dashboard] Deleted template:', templateId);
        } else {
          alert('Failed to delete template');
        }
      } catch (error) {
        console.error('[Dashboard] Error deleting template:', error);
        alert('Error deleting template');
      }
    }
    setActiveDropdown(null);
  }, []);

  // Handle toggling template public/private
  const handleTogglePublic = useCallback(async (
    template: Pick<DashboardTemplate, 'id' | 'isPublic' | 'publicationStatus'>,
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const previous = { isPublic: template.isPublic, publicationStatus: template.publicationStatus };
    const requestedPublic = !(template.isPublic || template.publicationStatus === 'pending_review');
    setTemplates((current) => current.map((item) => item.id === template.id
      ? { ...item, isPublic: false, publicationStatus: requestedPublic ? 'pending_review' : 'private' }
      : item));

    try {
      const response = await authenticatedFetch(`/api/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: requestedPublic }),
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates((current) => current.map((item) => item.id === template.id
          ? { ...item, ...data.template }
          : item));
      } else {
        throw new Error('Publication request failed');
      }
    } catch (error) {
      console.error('[Dashboard] Error toggling visibility:', error);
      setTemplates((current) => current.map((item) => item.id === template.id
        ? { ...item, ...previous }
        : item));
    }
    setActiveDropdown(null);
  }, []);

  // Filter templates by search query (both user and public)
  const filteredUserTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(tmpl => 
      tmpl.name.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  const ownTemplateIds = useMemo(
    () => new Set(templates.map(template => template.id)),
    [templates]
  );

  const visiblePublicTemplates = useMemo(
    () =>
      templatesLoading
        ? []
        : publicTemplates.filter(template => !ownTemplateIds.has(template.id)),
    [publicTemplates, ownTemplateIds, templatesLoading]
  );

  const filteredPublicTemplates = useMemo(() => {
    if (!searchQuery.trim()) return visiblePublicTemplates;
    const query = searchQuery.toLowerCase();
    return visiblePublicTemplates.filter(tmpl =>
      tmpl.name.toLowerCase().includes(query)
    );
  }, [visiblePublicTemplates, searchQuery]);

  // Get current templates based on tab
  const displayTemplates = templateTab === 'my' ? filteredUserTemplates : filteredPublicTemplates;

  // Recent activity from certificates (sorted by creation date, newest first)
  const sortedCertificates = useMemo(() => 
    [...certificates].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ), [certificates]
  );

  // Show loading state while checking auth
  if (isLoading || !isAuthenticated) {
    return <AuthLoading />;
  }

  // Show skeleton while data is loading
  const isDataLoading = templatesLoading || certificatesLoading;
  // Stat cards wait for the exact totals, or for the list they fall back to.
  const isStatsLoading = statsState === 'loading' || (statsState === 'unavailable' && isDataLoading);

  // Account totals: exact server aggregates, or (if those are unavailable)
  // what the recent records show.
  const totalTemplates = accountStats?.totalTemplates ?? templates.length;
  const totalCertificates = accountStats?.totalCertificates ?? certificates.length;
  const totalViews = accountStats?.totalViews ?? certificates.reduce((sum, cert) => sum + cert.viewCount, 0);
  
  // Calculate email stats
  const emailsSent = accountStats?.emailsSent ?? certificates.filter(c => c.emailStatus === 'sent').length;
  const emailsFailed = accountStats?.emailsFailed ?? certificates.filter(c => c.emailStatus === 'failed').length;
  const emailSuccessRate = emailsSent + emailsFailed > 0 
    ? Math.round((emailsSent / (emailsSent + emailsFailed)) * 100) 
    : 100;
  
  // Calculate monthly stats (certificates created in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thisMonthCerts = accountStats?.certificatesLast30Days ?? certificates.filter(c => new Date(c.createdAt) >= thirtyDaysAgo).length;
  
  // Calculate previous month stats for comparison
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const lastMonthCerts = accountStats?.certificatesPrevious30Days ?? certificates.filter(c => {
    const date = new Date(c.createdAt);
    return date >= sixtyDaysAgo && date < thirtyDaysAgo;
  }).length;
  const certGrowth = lastMonthCerts > 0 ? Math.round(((thisMonthCerts - lastMonthCerts) / lastMonthCerts) * 100) : 0;

  const stats = [
    { 
      id: 'templates', 
      label: 'Templates', 
      value: totalTemplates, 
      change: totalTemplates > 0 ? `${totalTemplates} saved` : 'No templates yet',
      icon: FileText, 
      tile: 'tile-secondary',
      isPositive: true
    },
    { 
      id: 'generated', 
      label: 'Certificates Generated', 
      value: totalCertificates, 
      change: thisMonthCerts > 0 
        ? `+${thisMonthCerts} this month${certGrowth !== 0 ? ` (${certGrowth > 0 ? '+' : ''}${certGrowth}%)` : ''}`
        : 'Start generating!',
      icon: Users, 
      tile: 'tile-primary',
      isPositive: certGrowth >= 0
    },
    { 
      id: 'emails', 
      label: 'Emails Sent', 
      value: emailsSent, 
      change: emailsFailed > 0 
        ? `${emailSuccessRate}% success rate (${emailsFailed} failed)`
        : emailsSent > 0 ? '100% success rate' : 'No emails sent yet',
      icon: Mail, 
      tile: 'tile-warning',
      isPositive: emailSuccessRate >= 90
    },
    { 
      id: 'views', 
      label: 'Verification Views', 
      value: totalViews, 
      change: totalViews > 0 ? `${totalViews} total ${plural(totalViews, 'view')}` : 'No views yet',
      icon: Eye, 
      tile: 'tile-accent',
      isPositive: true
    },
  ];

  // Format templates for display (use display templates based on tab)
  const recentTemplates = displayTemplates.slice(0, 6).map((tmpl, i) => ({
    id: tmpl.id,
    name: tmpl.name,
    lastUsed: formatTimeAgo(new Date(tmpl.updatedAt)),
    count: tmpl.certificateCount,
    thumbnail: tmpl.thumbnail || placeholderTints[i % placeholderTints.length],
    isPublic: tmpl.isPublic,
    creatorName: tmpl.creatorName,
    stars: tmpl.stars || 0,
    userId: tmpl.userId,
    publicationStatus: tmpl.publicationStatus,
  }));

  const recentActivity = sortedCertificates.slice(0, 5).map((cert, i) => ({
    id: i + 1,
    action: `Certificate for ${cert.recipientName}`,
    template: cert.templateName || 'Unknown Template',
    time: formatTimeAgo(new Date(cert.createdAt)),
    emailStatus: cert.emailStatus || 'not_sent',
    recipientEmail: cert.recipientEmail,
  }));

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (file.size > MAX_TEMPLATE_FILE_BYTES) {
      alert('This file is larger than 10 MB, so it cannot be imported as a template.');
      e.target.value = '';
      return;
    }

    setImportLoading(true);
    
    try {
      // Read the file content
      const text = await file.text();
      const templateData = JSON.parse(text);
      
      // Validate it's a valid template (has objects array or canvasJSON)
      let rawCanvasJSON: string;
      let templateName = templateData.name || file.name.replace('.json', '');

      if (templateData.canvasJSON) {
        // Already a Serenity template format
        rawCanvasJSON = typeof templateData.canvasJSON === 'string'
          ? templateData.canvasJSON
          : JSON.stringify(templateData.canvasJSON);
      } else if (templateData.objects) {
        // Fabric.js canvas format
        rawCanvasJSON = JSON.stringify(templateData);
      } else {
        throw new Error('Invalid template format. Expected Serenity or Fabric.js format.');
      }

      // Same checks and repairs as the editor's Import JSON: files exported
      // by earlier releases lack the verification flag the server requires.
      const parsed = parseTemplateFile(rawCanvasJSON);
      if (!parsed.ok) throw new Error(parsed.error);
      const canvasJSON = JSON.stringify(parsed.template);
      
      // Create new template via API
      const response = await authenticatedFetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${templateName} (Imported)`,
          canvasJSON,
          isPublic: false,
          creatorName: user.name,
          creatorEmail: user.email,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create template');
      }
      
      const data = await response.json();
      
      if (data.success && data.template?.id) {
        // Redirect to editor with the new template
        router.push(`/editor?template=${data.template.id}`);
      } else {
        throw new Error('Template created but no ID returned');
      }
    } catch (error) {
      console.error('[Dashboard] Import error:', error);
      alert(error instanceof Error ? error.message : 'Failed to import template');
    } finally {
      setImportLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="app-shell dashboard-shell min-h-screen">
      <SiteNav />

      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="workspace-intro">
          <GuillocheSeal id="studio-seal" className="workspace-rosette" draw />
          <div>
            <h1>Certificate studio</h1>
            <p>{user?.name ? `Welcome back, ${user.name.split(' ')[0]}.` : 'Welcome back.'} Choose a design or continue your recent work.</p>
            {!isStatsLoading && totalCertificates > 0 && (
              <p className="text-sm"><span>{emailsSent} sent</span>{emailsFailed > 0 && <span> · {emailsFailed} failed</span>}</p>
            )}
            <div className="workspace-actions">
              <Link href="/templates" className="btn-primary"><FileText size={17} />Start from a template</Link>
              <Link href="/editor" className="btn-outline"><Plus size={17} />Blank design</Link>
            </div>
          </div>
          <Link href={`/editor?template=${HONOURS_ID}`} className="workspace-feature">
            <Image unoptimized src={honoursThumbnail} width={842} height={595} alt="" />
            <span>{HONOURS_NAME}<ArrowRight size={17} aria-hidden="true" /></span>
          </Link>
        </section>

        {summaryError && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <span>Your recent templates and certificates could not be loaded. {summaryError}</span>
            <button
              type="button"
              onClick={() => {
                setSummaryError(null);
                setTemplatesLoading(true);
                setCertificatesLoading(true);
                setSummaryAttempt((attempt) => attempt + 1);
              }}
              className="rounded-lg border border-border bg-card px-3 py-1.5 font-medium hover:bg-muted"
            >
              Retry
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div
          className="dashboard-ledger mb-8 grid grid-cols-2 lg:grid-cols-4"
        >
          {isStatsLoading ? (
            // Skeleton loading state for stats
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="relative overflow-hidden p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-xl" />
                </div>
              </div>
            ))
          ) : (
            stats.map((stat) => (
            <div
              key={stat.id}
              className="dashboard-stat-card relative overflow-hidden p-4 transition-colors duration-300 hover:bg-muted/40 sm:p-6"
            >
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">
                    {stat.label}
                  </p>
                  <p className="dashboard-stat-value text-3xl sm:text-4xl">
                    {stat.value.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    {stat.isPositive ? (
                      <TrendingUp className="h-3 w-3 text-success" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-destructive" />
                    )}
                    <span className={`text-xs font-medium ${stat.isPositive ? 'text-success' : 'text-destructive'}`}>
                      {stat.change}
                    </span>
                  </div>
                </div>
                <div className={`${stat.tile} h-10 w-10 sm:h-12 sm:w-12`}>
                  <stat.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
            </div>
          ))
          )}
        </div>

        <div className="workspace-links">
          <Link href="/my-templates"><FileText size={17} /> My Templates</Link>
          <button type="button" onClick={handleImportClick} disabled={importLoading}><Upload size={17} /> Import Template</button>
          <input aria-label="Import Template" ref={fileInputRef} type="file" accept=".json" onChange={handleFileImport} hidden />
          <Link href="/history"><Clock size={17} /> View History</Link>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Templates Section - 2 columns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search templates..."
                aria-label="Search templates"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input h-10 w-full pl-10 pr-4"
              />
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h2 className="font-display text-xl font-semibold">Templates</h2>
                {/* Tabs */}
                <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
                  <button
                    onClick={() => setTemplateTab('my')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      templateTab === 'my'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    My Templates ({templates.length})
                  </button>
                  <button
                    onClick={() => setTemplateTab('public')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      templateTab === 'public'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Globe className="inline h-3.5 w-3.5 mr-1" />
                    Public ({visiblePublicTemplates.length})
                  </button>
                </div>
              </div>
              <Link
                href={templateTab === 'my' ? '/my-templates' : '/templates'}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                View All
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(templateTab === 'my'
                ? templatesLoading
                : publicTemplatesLoading || templatesLoading) ? (
                // Skeleton loading state
                <>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <SkeletonCard key={i} />
                  ))}
                </>
              ) : recentTemplates.length === 0 ? (
                <div className="col-span-full rounded-xl border-2 border-dashed border-border p-8 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    {templateTab === 'my' ? (
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    ) : (
                      <Globe className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <h3 className="font-semibold">
                    {templateTab === 'my' ? 'No templates yet' : 'No public templates'}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {templateTab === 'my' 
                      ? 'Create your first certificate template!'
                      : 'Be the first to share a template with the community.'
                    }
                  </p>
                  <Link href="/editor" className="btn-primary mt-4 inline-flex text-sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Create Template
                  </Link>
                </div>
              ) : (
                <AnimatePresence>
                  {recentTemplates.map((template, index) => (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -4 }}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm backdrop-blur-xl transition-all duration-300 hover:border-primary/40 hover:shadow-xl"
                  >
                    {/* Thumbnail */}
                    <div className="h-28 relative">
                      {template.thumbnail?.startsWith('data:') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                          src={template.thumbnail} 
                          alt={template.name}
                          className="w-full h-full object-cover"
                        />
                      ) : template.thumbnail?.startsWith('http') ? (
                        <Image 
                          src={template.thumbnail} 
                          alt={template.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          priority={index < 3}
                        />
                      ) : (
                        <div className={`w-full h-full ${template.thumbnail || placeholderTints[index % placeholderTints.length]}`} />
                      )}
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                      
                      {/* Public badge (only for my templates that are public) */}
                      {templateTab === 'my' && template.isPublic && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/90 text-white text-xs font-medium">
                          <Globe className="h-3 w-3" />
                          Public
                        </div>
                      )}
                      
                      {/* Stars badge for public templates */}
                      {templateTab === 'public' && template.stars > 0 && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/90 text-white text-xs font-medium">
                          <Bookmark className="h-3 w-3 fill-current" />
                          {template.stars}
                        </div>
                      )}
                      
                      {/* Quick action buttons - only for user's own templates */}
                      {templateTab === 'my' && (
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleTogglePublic(template, e)}
                            className={`p-1 rounded-md backdrop-blur-sm transition-colors ${
                              template.isPublic || template.publicationStatus === 'pending_review'
                                ? 'bg-warning/90 text-white hover:bg-warning/90'
                                : 'bg-white/20 text-white hover:bg-white/30'
                            }`}
                            title={template.publicationStatus === 'pending_review' ? 'Cancel review request' : template.isPublic ? 'Make private' : 'Submit for review'}
                          >
                            {template.publicationStatus === 'pending_review'
                              ? <Clock className="h-3.5 w-3.5" />
                              : <Globe className="h-3.5 w-3.5" />}
                          </button>
                          
                          <button
                            onClick={(e) => handleDeleteTemplate(template.id, e)}
                            className="p-1 rounded-md bg-error/80 backdrop-blur-sm text-white hover:bg-error/90 transition-colors"
                            title="Delete Template"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <Link href={`/editor?template=${template.id}`} className="block p-3">
                      <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                        {template.name}
                      </h3>
                      {templateTab === 'public' && template.creatorName && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          by {template.creatorName}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {template.lastUsed}
                        </span>
                        <span>{template.count.toLocaleString()} used</span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
              )}

              {/* Create New Card */}
              {!templatesLoading && (
                <Link href="/editor">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex flex-col items-center justify-center h-full min-h-[200px] rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all duration-200"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground mb-3">
                      <Plus className="h-6 w-6" />
                    </div>
                    <p className="font-semibold">Create New Template</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Start with a blank canvas
                    </p>
                  </motion.div>
                </Link>
              )}
            </div>
          </motion.div>

          {/* Recent Activity - 1 column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-semibold">Recent Activity</h2>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg shadow-slate-950/5 backdrop-blur-xl">
              <div className="divide-y divide-border">
                {certificatesLoading ? (
                  // Skeleton loading state for activity
                  <>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-start gap-3 p-4">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </>
                ) : recentActivity.length > 0 ? (
                  recentActivity.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 mt-0.5 ${
                      activity.emailStatus === 'sent' 
                        ? 'bg-success/10 text-success' 
                        : activity.emailStatus === 'failed'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-primary/10 text-primary'
                    }`}>
                      {activity.emailStatus === 'sent' ? (
                        <MailCheck className="h-4 w-4" />
                      ) : activity.emailStatus === 'failed' ? (
                        <MailX className="h-4 w-4" />
                      ) : (
                        <Calendar className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{activity.action}</p>
                        {activity.emailStatus === 'sent' && (
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-success/10 text-success">
                            Sent
                          </span>
                        )}
                        {activity.emailStatus === 'failed' && (
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-destructive/10 text-destructive">
                            Failed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.template} • {activity.time}
                      </p>
                    </div>
                  </motion.div>
                ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <p className="text-sm">No recent activity</p>
                    <p className="text-xs mt-1">Generate some certificates to see activity here</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-border">
                <Link
                  href="/history"
                  className="flex items-center justify-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  View all activity
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
  return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
}
