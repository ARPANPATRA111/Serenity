'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth, AuthLoading } from '@/contexts/AuthContext';
import { 
  Plus, 
  FileText, 
  Users, 
  Eye, 
  ArrowRight, 
  Upload,
  Clock,
  Sparkles,
  TrendingUp,
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
  Star
} from 'lucide-react';
import { SkeletonDashboard, Skeleton, SkeletonCard } from '@/components/ui/Skeleton';

// Certificate interface for Firebase data
interface CertificateRecord {
  id: string;
  recipientName: string;
  recipientEmail?: string;
  title: string;
  issuerName: string;
  issuedAt: number;
  templateId?: string;
  templateName?: string;
  isActive: boolean;
  viewCount: number;
  createdAt: string;
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

// Gradient colors for templates
const gradientColors = [
  'from-amber-400 to-orange-500',
  'from-blue-400 to-indigo-500',
  'from-emerald-400 to-teal-500',
  'from-violet-400 to-purple-500',
  'from-rose-400 to-pink-500',
  'from-cyan-400 to-blue-500',
];

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Real data from API (Firebase)
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [certificatesLoading, setCertificatesLoading] = useState(true);

  // Fetch certificates from Firebase API
  useEffect(() => {
    async function fetchCertificates() {
      if (!user?.id) {
        setCertificatesLoading(false);
        return;
      }
      
      try {
        const response = await fetch('/api/certificates', {
          headers: {
            'x-user-id': user.id,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('[Dashboard] Loaded certificates from API:', data.certificates?.length || 0);
          setCertificates(data.certificates || []);
        }
      } catch (error) {
        console.error('[Dashboard] Error fetching certificates:', error);
      } finally {
        setCertificatesLoading(false);
      }
    }

    fetchCertificates();
  }, [user?.id]);

  // Fetch templates from API
  useEffect(() => {
    async function fetchTemplates() {
      if (!user?.id) {
        setTemplatesLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/templates?userId=${user.id}`);
        if (response.ok) {
          const data = await response.json();
          console.log('[Dashboard] Loaded templates from API:', data.templates?.length || 0);
          setTemplates(data.templates || []);
        }
      } catch (error) {
        console.error('[Dashboard] Error fetching templates:', error);
      } finally {
        setTemplatesLoading(false);
      }
    }

    fetchTemplates();
  }, [user?.id]);

  // Handle template deletion via API
  const handleDeleteTemplate = useCallback(async (templateId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        const response = await fetch(`/api/templates/${templateId}`, {
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
  const handleTogglePublic = useCallback(async (templateId: string, currentlyPublic: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: !currentlyPublic }),
      });
      
      if (response.ok) {
        setTemplates(prev => prev.map(t => 
          t.id === templateId ? { ...t, isPublic: !currentlyPublic } : t
        ));
        console.log('[Dashboard] Toggled template visibility:', templateId, !currentlyPublic);
      }
    } catch (error) {
      console.error('[Dashboard] Error toggling visibility:', error);
    }
    setActiveDropdown(null);
  }, []);

  // Filter templates by search query
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(tmpl => 
      tmpl.name.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

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
  
  // Calculate monthly stats (certificates created in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thisMonthCerts = certificates.filter(c => new Date(c.createdAt) >= thirtyDaysAgo).length;

  const stats = [
    { 
      id: 'templates', 
      label: 'Templates', 
      value: totalTemplates, 
      change: totalTemplates > 0 ? `${totalTemplates} saved` : 'No templates yet',
      icon: FileText, 
      color: 'from-violet-500 to-purple-600',
      bgColor: 'bg-violet-500/10',
      textColor: 'text-violet-600 dark:text-violet-400'
    },
    { 
      id: 'generated', 
      label: 'Certificates Generated', 
      value: totalCertificates, 
      change: thisMonthCerts > 0 ? `+${thisMonthCerts} this month` : 'Start generating!',
      icon: Users, 
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-600 dark:text-blue-400'
    },
    { 
      id: 'views', 
      label: 'Verification Views', 
      value: totalViews, 
      change: totalViews > 0 ? `${totalViews} total views` : 'No views yet',
      icon: Eye, 
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-500/10',
      textColor: 'text-emerald-600 dark:text-emerald-400'
    },
  ];

  // Format templates for display (use filtered templates)
  const recentTemplates = filteredTemplates.slice(0, 4).map((tmpl, i) => ({
    id: tmpl.id,
    name: tmpl.name,
    lastUsed: formatTimeAgo(new Date(tmpl.updatedAt)),
    count: tmpl.certificateCount,
    thumbnail: tmpl.thumbnail || gradientColors[i % gradientColors.length],
    isPublic: tmpl.isPublic,
  }));

  const recentActivity = sortedCertificates.slice(0, 4).map((cert, i) => ({
    id: i + 1,
    action: `Certificate generated for ${cert.recipientName}`,
    template: cert.templateName || 'Unknown Template',
    time: formatTimeAgo(new Date(cert.createdAt)),
  }));

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Handle template import
      console.log('Importing:', file.name);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <motion.nav 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 border-b border-border/50 glass"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold">Serenity</span>
          </Link>
          
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
                      <p className="font-medium truncate">{user?.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <div className="p-2">
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

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-3xl sm:text-4xl font-bold">
            Welcome back, {user?.name?.split(' ')[0] || 'there'}! 👋
          </h1>
          <p className="mt-2 text-muted-foreground">
            Here&apos;s what&apos;s happening with your certificates today.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div 
          initial="initial"
          animate="animate"
          variants={staggerContainer}
          className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8"
        >
          {isDataLoading ? (
            // Skeleton loading state for stats
            [1, 2, 3].map((i) => (
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
              className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-lg transition-all duration-300"
            >
              {/* Background gradient */}
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2`} />
              
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {stat.label}
                  </p>
                  <p className="text-3xl font-bold tracking-tight">
                    {stat.value.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <TrendingUp className="h-3 w-3 text-success" />
                    <span className="text-xs text-success font-medium">
                      {stat.change}
                    </span>
                  </div>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.textColor}`} />
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
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200"
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
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground">
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
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Import Template</p>
                <p className="text-sm text-muted-foreground">Upload JSON file</p>
              </div>
              <input
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
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground">
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
          {/* Recent Templates - 2 columns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-semibold">Recent Templates</h2>
              <Link
                href="/templates"
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                View All
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {templatesLoading ? (
                // Skeleton loading state
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <SkeletonCard key={i} />
                  ))}
                </>
              ) : (
                <AnimatePresence>
                  {recentTemplates.map((template, index) => (
                  <motion.div
                    key={template.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -4 }}
                    className="group relative rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all duration-300"
                  >
                    {/* Thumbnail */}
                    <div className="h-32 relative">
                      {template.thumbnail?.startsWith('data:') || template.thumbnail?.startsWith('http') ? (
                        <img 
                          src={template.thumbnail} 
                          alt={template.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${template.thumbnail || gradientColors[0]}`} />
                      )}
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                      
                      {/* Public/Private badge */}
                      {template.isPublic && (
                        <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/90 text-white text-xs font-medium">
                          <Globe className="h-3 w-3" />
                          Public
                        </div>
                      )}
                      
                      {/* Quick action buttons - visible on hover */}
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Star/Public toggle button */}
                        <button
                          onClick={(e) => handleTogglePublic(template.id, template.isPublic, e)}
                          className={`p-1.5 rounded-lg backdrop-blur-sm transition-colors ${
                            template.isPublic 
                              ? 'bg-yellow-500/90 text-white hover:bg-yellow-600/90' 
                              : 'bg-white/20 text-white hover:bg-white/30'
                          }`}
                          title={template.isPublic ? 'Make Private' : 'Make Public (Star)'}
                        >
                          <Star className={`h-4 w-4 ${template.isPublic ? 'fill-current' : ''}`} />
                        </button>
                        
                        {/* Delete button */}
                        <button
                          onClick={(e) => handleDeleteTemplate(template.id, e)}
                          className="p-1.5 rounded-lg bg-red-500/80 backdrop-blur-sm text-white hover:bg-red-600/90 transition-colors"
                          title="Delete Template"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        
                        {/* More options dropdown */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setActiveDropdown(activeDropdown === template.id ? null : template.id);
                          }}
                          className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                        
                      {/* Dropdown Menu */}
                      <AnimatePresence>
                        {activeDropdown === template.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute right-3 top-12 w-44 rounded-lg border border-border bg-card shadow-lg py-1 z-10"
                          >
                            <Link
                              href={`/editor?template=${template.id}`}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors"
                            >
                              <Edit3 className="h-4 w-4" />
                              Edit Template
                            </Link>
                            <button 
                              onClick={(e) => handleTogglePublic(template.id, template.isPublic, e)}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors"
                            >
                              {template.isPublic ? (
                                <>
                                  <Lock className="h-4 w-4" />
                                  Make Private
                                </>
                              ) : (
                                <>
                                  <Star className="h-4 w-4" />
                                  Make Public
                                </>
                              )}
                            </button>
                            <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors">
                              <Download className="h-4 w-4" />
                              Export
                            </button>
                            <hr className="my-1 border-border" />
                            <button 
                              onClick={(e) => handleDeleteTemplate(template.id, e)}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Content */}
                    <Link href={`/editor?template=${template.id}`} className="block p-4">
                      <h3 className="font-semibold group-hover:text-primary transition-colors truncate">
                        {template.name}
                      </h3>
                      <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {template.lastUsed}
                        </span>
                        <span>{template.count.toLocaleString()} generated</span>
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

            <div className="rounded-xl border border-border bg-card">
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{activity.action}</p>
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

/**
 * Format date to human-readable time ago string
 */
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
