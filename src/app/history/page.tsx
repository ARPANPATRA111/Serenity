'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { 
  ArrowLeft, 
  Calendar, 
  Eye, 
  Search, 
  Award,
  ChevronRight,
  Mail,
  MailCheck,
  MailX,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Filter,
  Users,
  FileText
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface CertificateRecord {
  id: string;
  recipientName: string;
  recipientEmail: string;
  title: string;
  issuerName: string;
  issuedAt: number;
  templateId?: string;
  templateName?: string;
  isActive: boolean;
  viewCount: number;
  createdAt: string;
  emailStatus: 'not_sent' | 'sent' | 'failed';
  emailSentAt: string | null;
  emailError: string | null;
  certificateImage?: string | null;
}

interface BatchGroup {
  id: string;
  templateName: string;
  generatedAt: string;
  certificates: CertificateRecord[];
  totalViews: number;
  sentCount: number;
  failedCount: number;
  notSentCount: number;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'failed' | 'not_sent'>('all');
  
  // Resend email modal state
  const [resendModal, setResendModal] = useState<{
    isOpen: boolean;
    certificate: CertificateRecord | null;
    newEmail: string;
    sending: boolean;
    error: string | null;
    success: boolean;
  }>({
    isOpen: false,
    certificate: null,
    newEmail: '',
    sending: false,
    error: null,
    success: false,
  });

  const fetchCertificates = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch('/api/certificates', {
        headers: { 'x-user-id': user.id },
        cache: 'no-store',
      });
      
      if (response.ok) {
        const data = await response.json();
        setCertificates(data.certificates || []);
      }
    } catch (error) {
      console.error('[HistoryPage] Error fetching certificates:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  // Group certificates by template and date
  const batchGroups = useMemo((): BatchGroup[] => {
    const groups: Record<string, BatchGroup> = {};
    
    certificates.forEach(cert => {
      const dateKey = new Date(cert.createdAt).toDateString();
      const templateName = cert.templateName || 'Unknown Template';
      const groupKey = `${templateName}-${dateKey}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          templateName,
          generatedAt: cert.createdAt,
          certificates: [],
          totalViews: 0,
          sentCount: 0,
          failedCount: 0,
          notSentCount: 0,
        };
      }
      
      groups[groupKey].certificates.push(cert);
      groups[groupKey].totalViews += cert.viewCount;
      
      if (cert.emailStatus === 'sent') groups[groupKey].sentCount++;
      else if (cert.emailStatus === 'failed') groups[groupKey].failedCount++;
      else groups[groupKey].notSentCount++;
      
      if (new Date(cert.createdAt) < new Date(groups[groupKey].generatedAt)) {
        groups[groupKey].generatedAt = cert.createdAt;
      }
    });
    
    return Object.values(groups).sort((a, b) => 
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );
  }, [certificates]);

  // Filter batches by search and status
  const filteredBatches = useMemo(() => {
    return batchGroups.map(batch => {
      let filteredCerts = batch.certificates;
      
      // Filter by search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filteredCerts = filteredCerts.filter(cert => 
          cert.recipientName.toLowerCase().includes(query) ||
          cert.recipientEmail.toLowerCase().includes(query) ||
          cert.title.toLowerCase().includes(query)
        );
      }
      
      // Filter by status
      if (filterStatus !== 'all') {
        filteredCerts = filteredCerts.filter(cert => cert.emailStatus === filterStatus);
      }
      
      return { ...batch, certificates: filteredCerts };
    }).filter(batch => batch.certificates.length > 0 || (searchQuery === '' && filterStatus === 'all'));
  }, [batchGroups, searchQuery, filterStatus]);

  const toggleBatch = (batchId: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  const openResendModal = (cert: CertificateRecord) => {
    setResendModal({
      isOpen: true,
      certificate: cert,
      newEmail: cert.recipientEmail || '',
      sending: false,
      error: null,
      success: false,
    });
  };

  const closeResendModal = () => {
    setResendModal(prev => ({ ...prev, isOpen: false }));
    // Refresh certificates after a short delay to get updated status
    setTimeout(() => fetchCertificates(), 500);
  };

  const handleResendEmail = async () => {
    if (!resendModal.certificate || !resendModal.newEmail) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resendModal.newEmail)) {
      setResendModal(prev => ({ ...prev, error: 'Please enter a valid email address' }));
      return;
    }

    setResendModal(prev => ({ ...prev, sending: true, error: null }));

    try {
      const cert = resendModal.certificate;
      const verifyUrl = `${window.location.origin}/verify/${cert.id}`;
      
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: resendModal.newEmail,
          recipientName: cert.recipientName,
          certificateId: cert.id,
          certificateTitle: cert.title,
          issuerName: cert.issuerName,
          verifyUrl,
          userId: user?.id,
          // Include certificate image for attachment
          certificateImageUrl: cert.certificateImage || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResendModal(prev => ({ ...prev, sending: false, success: true }));
        // Update local state
        setCertificates(prev => prev.map(c => 
          c.id === cert.id 
            ? { ...c, emailStatus: 'sent' as const, recipientEmail: resendModal.newEmail, emailSentAt: new Date().toISOString(), emailError: null }
            : c
        ));
      } else {
        setResendModal(prev => ({ ...prev, sending: false, error: data.error || 'Failed to send email' }));
      }
    } catch (error) {
      setResendModal(prev => ({ 
        ...prev, 
        sending: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      }));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
            <MailCheck className="h-3 w-3" /> Sent
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
            <MailX className="h-3 w-3" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
            <Clock className="h-3 w-3" /> Not Sent
          </span>
        );
    }
  };

  const totalStats = useMemo(() => ({
    total: certificates.length,
    sent: certificates.filter(c => c.emailStatus === 'sent').length,
    failed: certificates.filter(c => c.emailStatus === 'failed').length,
    notSent: certificates.filter(c => c.emailStatus === 'not_sent').length,
    totalViews: certificates.reduce((sum, c) => sum + c.viewCount, 0),
  }), [certificates]);

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
              New Certificate
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
          <h1 className="font-display text-3xl font-bold">Certificate History</h1>
          <p className="mt-1 text-muted-foreground">
            Track, manage, and resend certificate emails
          </p>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.total}</p>
                <p className="text-xs text-muted-foreground">Total Certificates</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <MailCheck className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.sent}</p>
                <p className="text-xs text-muted-foreground">Emails Sent</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-500/10 p-2">
                <MailX className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Eye className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStats.totalViews}</p>
                <p className="text-xs text-muted-foreground">Total Views</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 pr-4 h-10 w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="input h-10 w-40"
            >
              <option value="all">All Status</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="not_sent">Not Sent</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="card py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Loading certificates...</p>
          </div>
        ) : filteredBatches.length > 0 ? (
          <div className="space-y-4">
            {filteredBatches.map((batch) => (
              <div key={batch.id} className="card overflow-hidden">
                {/* Batch Header */}
                <button
                  onClick={() => toggleBatch(batch.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`transition-transform ${expandedBatches.has(batch.id) ? 'rotate-90' : ''}`}>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold">{batch.templateName}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(batch.generatedAt).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {batch.certificates.length} certificates
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" />
                          {batch.totalViews} views
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {batch.sentCount > 0 && (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                        {batch.sentCount} sent
                      </span>
                    )}
                    {batch.failedCount > 0 && (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                        {batch.failedCount} failed
                      </span>
                    )}
                    {batch.notSentCount > 0 && (
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-500/10 text-gray-600 dark:text-gray-400">
                        {batch.notSentCount} pending
                      </span>
                    )}
                  </div>
                </button>

                {/* Expanded Certificate List */}
                {expandedBatches.has(batch.id) && (
                  <div className="border-t border-border">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Recipient</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Views</th>
                            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {batch.certificates.map((cert) => (
                            <tr key={cert.id} className="hover:bg-muted/20">
                              <td className="px-4 py-3 font-medium">{cert.recipientName}</td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {cert.recipientEmail || <span className="italic text-gray-400">No email</span>}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1">
                                  {getStatusBadge(cert.emailStatus)}
                                  {cert.emailSentAt && (
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(cert.emailSentAt).toLocaleString()}
                                    </span>
                                  )}
                                  {cert.emailError && (
                                    <span className="text-xs text-red-500">{cert.emailError}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{cert.viewCount}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Link
                                    href={`/verify/${cert.id}`}
                                    target="_blank"
                                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                                    title="View Certificate"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                  <button
                                    onClick={() => openResendModal(cert)}
                                    className="p-2 rounded-lg hover:bg-primary/10 text-primary"
                                    title={cert.emailStatus === 'sent' ? 'Resend Email' : 'Send Email'}
                                  >
                                    {cert.emailStatus === 'sent' ? (
                                      <RefreshCw className="h-4 w-4" />
                                    ) : (
                                      <Mail className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="card py-16 text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted p-3">
              <Calendar className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold">
              {searchQuery || filterStatus !== 'all' ? 'No Results Found' : 'No Certificates Yet'}
            </h3>
            <p className="mt-1 text-muted-foreground">
              {searchQuery || filterStatus !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Generate certificates to see them here'
              }
            </p>
            {!searchQuery && filterStatus === 'all' && (
              <Link href="/editor" className="btn-primary mt-6 inline-flex">
                Create Your First Certificate
              </Link>
            )}
          </div>
        )}

        {/* Summary */}
        {!loading && certificates.length > 0 && (
          <div className="mt-6 text-sm text-muted-foreground text-center">
            Showing {filteredBatches.reduce((sum, b) => sum + b.certificates.length, 0)} of {certificates.length} certificates
          </div>
        )}
      </main>

      {/* Resend Email Modal */}
      <Modal
        isOpen={resendModal.isOpen}
        onClose={closeResendModal}
        title={resendModal.success ? 'Email Sent!' : 'Send Certificate Email'}
      >
        {resendModal.success ? (
          <div className="text-center py-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold">Email Sent Successfully!</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Certificate has been sent to <strong>{resendModal.newEmail}</strong>
            </p>
            <Button onClick={closeResendModal} className="mt-6 w-full">
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {resendModal.certificate && (
              <>
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Recipient:</span>
                    <span className="text-sm font-medium">{resendModal.certificate.recipientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Certificate:</span>
                    <span className="text-sm font-medium">{resendModal.certificate.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Current Status:</span>
                    {getStatusBadge(resendModal.certificate.emailStatus)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Email Address
                    <span className="text-muted-foreground font-normal ml-1">(you can edit)</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={resendModal.newEmail}
                      onChange={(e) => setResendModal(prev => ({ ...prev, newEmail: e.target.value, error: null }))}
                      className="input pl-10 pr-4 h-10 w-full"
                      placeholder="Enter email address"
                      disabled={resendModal.sending}
                    />
                  </div>
                </div>

                {/* Note about attachment */}
                <div className={`rounded-lg p-3 flex items-start gap-2 ${
                  resendModal.certificate?.certificateImage 
                    ? 'bg-green-500/10 border border-green-500/20' 
                    : 'bg-amber-500/10 border border-amber-500/20'
                }`}>
                  <AlertCircle className={`h-4 w-4 shrink-0 mt-0.5 ${
                    resendModal.certificate?.certificateImage ? 'text-green-500' : 'text-amber-500'
                  }`} />
                  <p className={`text-xs ${
                    resendModal.certificate?.certificateImage 
                      ? 'text-green-700 dark:text-green-400' 
                      : 'text-amber-700 dark:text-amber-400'
                  }`}>
                    {resendModal.certificate?.certificateImage 
                      ? <><strong>Certificate image will be attached</strong> to this email.</>
                      : <><strong>Note:</strong> No certificate image available. The recipient will receive a verification link only.</>
                    }
                  </p>
                </div>

                {resendModal.error && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-500">{resendModal.error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={closeResendModal}
                    className="flex-1"
                    disabled={resendModal.sending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleResendEmail}
                    className="flex-1"
                    disabled={resendModal.sending || !resendModal.newEmail}
                  >
                    {resendModal.sending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Email
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
