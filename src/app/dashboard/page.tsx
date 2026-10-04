'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth, AuthLoading } from '@/contexts/AuthContext';
import { authenticatedFetch } from '@/lib/api/authFetch';
import { coordinatedJson, readSessionJson, writeSessionJson } from '@/lib/api/requestCoordinator';
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
  LogOut,
  User,
  Globe,
  Lock,
  Settings,
  Bookmark,
  Mail,
  MailCheck,
  MailX,
  RefreshCw,
  CheckCircle2,
  Crown
} from 'lucide-react';
import { SkeletonDashboard, Skeleton, SkeletonCard } from '@/components/ui/Skeleton';
import { SerenityBrand } from '@/components/brand/SerenityBrand';
import { EVENTS_ENABLED } from '@/lib/featureFlags';

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

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 }
};

// Flat tints standing in for a template that has no thumbnail yet. Drawn from
// the palette rather than the full Tailwind spectrum, so a grid of them reads
// as one product instead of a colour chart.
const placeholderTints = [
  'bg-primary/15',
  'bg-secondary/15',
  'bg-accent/15',
  'bg-warning/15',
];

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [templateTab, setTemplateTab] = useState<'my' | 'public'>('my');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Real data from API (Firebase)
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [publicTemplates, setPublicTemplates] = useState<DashboardTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [certificatesLoading, setCertificatesLoading] = useState(true);
  const [publicTemplatesLoading, setPublicTemplatesLoading] = useState(true);
  const [importLoading, setImportLoading] = useState(false);

  // Fetch bounded private dashboard data in one authenticated request.
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
          () => authenticatedFetch('/api/dashboard-summary?templateLimit=6&certificateLimit=12'),
          15_000,
        );
        if (cancelled) return;
        setCertificates(data.recentCertificates || []);
        setTemplates(data.recentTemplates || []);
        writeSessionJson(cacheKey, data);
      } catch (error) {
        console.error('[Dashboard] Error fetching summary:', error);
      } finally {
        if (!cancelled) {
          setCertificatesLoading(false);
          setTemplatesLoading(false);
        }
      }
    }

    void fetchDashboardSummary();
    return () => { cancelled = true; };
  }, [user?.id]);

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

  // Calculate real statistics
  const totalTemplates = templates.length;
  const totalCertificates = certificates.length;
  const totalViews = certificates.reduce((sum, cert) => sum + cert.viewCount, 0);
  
  // Calculate email stats
  const emailsSent = certificates.filter(c => c.emailStatus === 'sent').length;
  const emailsFailed = certificates.filter(c => c.emailStatus === 'failed').length;
  const emailSuccessRate = emailsSent + emailsFailed > 0 
    ? Math.round((emailsSent / (emailsSent + emailsFailed)) * 100) 
    : 100;
  
  // Calculate monthly stats (certificates created in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thisMonthCerts = certificates.filter(c => new Date(c.createdAt) >= thirtyDaysAgo).length;
  
  // Calculate previous month stats for comparison
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const lastMonthCerts = certificates.filter(c => {
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
      change: totalViews > 0 ? `${totalViews} total views` : 'No views yet',
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
    
    setImportLoading(true);
    
    try {
      // Read the file content
      const text = await file.text();
      const templateData = JSON.parse(text);
      
      // Validate it's a valid template (has objects array or canvasJSON)
      let canvasJSON: string;
      let templateName = templateData.name || file.name.replace('.json', '');
      
      if (templateData.canvasJSON) {
        // Already a Serenity template format
        canvasJSON = typeof templateData.canvasJSON === 'string' 
          ? templateData.canvasJSON 
          : JSON.stringify(templateData.canvasJSON);
      } else if (templateData.objects) {
        // Fabric.js canvas format
        canvasJSON = JSON.stringify(templateData);
      } else {
        throw new Error('Invalid template format. Expected Serenity or Fabric.js format.');
      }
      
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
    <div className="app-shell dashboard-shell min-h-screen bg-background">
      {/* Navigation */}
      <motion.nav 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 bg-transparent px-3 pt-3 sm:px-5"
      >
        <div className="app-nav-frame mx-auto flex h-16 max-w-7xl items-center justify-between rounded-2xl border border-border/70 bg-background/80 px-4 shadow-xl shadow-slate-950/5 backdrop-blur-2xl sm:px-6 lg:px-7">
          <Link href="/" className="group"><SerenityBrand /></Link>
          
          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10 pr-4 h-10 w-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {EVENTS_ENABLED && (
            <Link href="/events" className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold transition hover:border-primary/40 hover:bg-muted md:inline-flex">
              <Calendar className="h-4 w-4" />
              Events
            </Link>
            )}
            <ThemeToggle />
            <Link href="/editor" className="btn-primary">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Certificate</span>
            </Link>
            
            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 hover:bg-muted transition-colors"
              >
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-medium">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="hidden sm:inline text-sm font-medium truncate max-w-[100px]">
                  {user?.name || 'User'}
                </span>
              </button>
              
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-xl z-50"
                  >
                    <div className="p-3 border-b border-border">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{user?.name}</p>
                        {user?.isPremium && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-warning dark:bg-warning/30 text-warning text-xs font-medium">
                            <Crown className="h-3 w-3" />
                            PRO
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <div className="p-2">
                      {!user?.isPremium && (
                        <Link
                          href="/premium"
                          onClick={() => setShowUserMenu(false)}
                          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-warning text-white hover:bg-warning/90 transition-colors mb-1"
                        >
                          <Crown className="h-4 w-4" />
                          Upgrade to Premium
                        </Link>
                      )}
                      <Link
                        href="/settings"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.nav>

      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="dashboard-welcome relative mb-8 overflow-hidden rounded-[2rem] border border-white/10 px-5 py-7 text-white shadow-2xl shadow-primary/20 sm:px-8 sm:py-9"
        >
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-display text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
                  Welcome back, {user?.name?.split(' ')[0] || 'there'}.
                </h1>
                {user?.isPremium && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning text-white text-sm font-semibold shadow-sm"
                  >
                    <Crown className="h-4 w-4" />
                    Premium
                  </motion.span>
                )}
              </div>
              <p className="mt-2 max-w-2xl text-slate-300">
                {totalCertificates === 0 
                  ? "Get started by creating your first certificate template."
                  : thisMonthCerts > 0 
                    ? `You've generated ${thisMonthCerts} certificate${thisMonthCerts > 1 ? 's' : ''} this month. Keep it up!`
                    : "Here's what's happening with your certificates today."
                }
              </p>
            </div>
            {/* Quick stats for today */}
            {!isDataLoading && totalCertificates > 0 && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 rounded-xl border border-success/15 bg-success/10 px-3 py-2 text-success backdrop-blur">
                  <MailCheck className="h-4 w-4" />
                  <span className="font-medium">{emailsSent} sent</span>
                </div>
                {emailsFailed > 0 && (
                  <div className="flex items-center gap-2 rounded-xl border border-error/15 bg-error/10 px-3 py-2 text-error backdrop-blur">
                    <MailX className="h-4 w-4" />
                    <span className="font-medium">{emailsFailed} failed</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div 
          initial="initial"
          animate="animate"
          variants={staggerContainer}
          className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4 mb-8"
        >
          {isDataLoading ? (
            // Skeleton loading state for stats
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
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
            stats.map((stat, index) => (
            <motion.div
              key={stat.id}
              variants={fadeInUp}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="dashboard-stat-card relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-md sm:p-6"
            >
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1">
                    {stat.label}
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold tracking-tight">
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
            </motion.div>
          ))
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="font-display text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/editor">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="dashboard-action-card flex cursor-pointer items-center gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Create New</p>
                  <p className="text-sm text-muted-foreground">Start from scratch</p>
                </div>
              </motion.div>
            </Link>

            <Link href="/templates">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="dashboard-action-card flex cursor-pointer items-center gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="tile-primary h-11 w-11 shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Browse Templates</p>
                  <p className="text-sm text-muted-foreground">Pre-made designs</p>
                </div>
              </motion.div>
            </Link>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleImportClick}
              className="dashboard-action-card flex cursor-pointer items-center gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-lg"
            >
              <div className="tile-warning h-11 w-11 shrink-0">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Import Template</p>
                <p className="text-sm text-muted-foreground">Upload JSON file</p>
              </div>
              <input
                aria-label="Import Template"
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
            </motion.div>

            <Link href="/history">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="dashboard-action-card flex cursor-pointer items-center gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="tile-secondary h-11 w-11 shrink-0">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">View History</p>
                  <p className="text-sm text-muted-foreground">Past generations</p>
                </div>
              </motion.div>
            </Link>
          </div>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Templates Section - 2 columns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
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
