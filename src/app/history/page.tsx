'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ArrowLeft, Download, Calendar, Users, Eye, Search, Award } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Certificate interface for Firebase data
interface CertificateRecord {
  id: string;
  recipientName: string;
  title: string;
  issuerName: string;
  issuedAt: number;
  templateId?: string;
  templateName?: string;
  isActive: boolean;
  viewCount: number;
  createdAt: string;
}

// Group certificates by templateName and date
interface HistoryItem {
  id: string;
  templateName: string;
  generatedAt: string;
  count: number;
  views: number;
  status: 'completed';
  certificateIds: string[];
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch certificates from Firebase API
  useEffect(() => {
    async function fetchCertificates() {
      if (!user?.id) {
        setLoading(false);
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
          console.log('[HistoryPage] Loaded certificates from API:', data.certificates?.length || 0);
          setCertificates(data.certificates || []);
        }
      } catch (error) {
        console.error('[HistoryPage] Error fetching certificates:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCertificates();
  }, [user?.id]);

  // Group certificates by template and date (same day batches)
  const historyItems = useMemo((): HistoryItem[] => {
    const groups: Record<string, HistoryItem> = {};
    
    certificates.forEach(cert => {
      // Group by templateName + date (to approximate batches)
      const dateKey = new Date(cert.createdAt).toDateString();
      const templateName = cert.templateName || 'Unknown Template';
      const groupKey = `${templateName}-${dateKey}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          id: groupKey,
          templateName,
          generatedAt: cert.createdAt,
          count: 0,
          views: 0,
          status: 'completed',
          certificateIds: [],
        };
      }
      
      groups[groupKey].count++;
      groups[groupKey].views += cert.viewCount;
      groups[groupKey].certificateIds.push(cert.id);
      
      // Use earliest date for the group
      if (new Date(cert.createdAt) < new Date(groups[groupKey].generatedAt)) {
        groups[groupKey].generatedAt = cert.createdAt;
      }
    });
    
    // Sort by date (newest first)
    return Object.values(groups).sort((a, b) => 
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );
  }, [certificates]);

  // Filter by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return historyItems;
    const query = searchQuery.toLowerCase();
    return historyItems.filter(item => 
      item.templateName.toLowerCase().includes(query)
    );
  }, [historyItems, searchQuery]);
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
          <h1 className="font-display text-3xl font-bold">Generation History</h1>
          <p className="mt-1 text-muted-foreground">
            View and manage your past certificate generations
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by template name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 pr-4 h-10 w-full"
            />
          </div>
        </div>

        {/* History Table */}
        {filteredItems.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                      Template
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Date
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Certificates
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Views
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <span className="font-medium">{item.templateName}</span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(item.generatedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium">{item.count}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-muted-foreground">{item.views}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
                          title="Download certificates"
                          onClick={() => console.log('Download batch:', item.certificateIds)}
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="card py-16 text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted p-3">
              <Calendar className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold">
              {searchQuery ? 'No Results Found' : 'No History Yet'}
            </h3>
            <p className="mt-1 text-muted-foreground">
              {searchQuery 
                ? 'Try adjusting your search query'
                : 'Your certificate generations will appear here'
              }
            </p>
            {!searchQuery && (
              <Link href="/editor" className="btn-primary mt-6 inline-flex">
                Create Your First Certificate
              </Link>
            )}
          </div>
        )}

        {/* Pagination placeholder */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {filteredItems.length} of {historyItems.length} generations
          </p>
          <div className="flex gap-2">
            <button
              className="btn-outline"
              disabled
            >
              Previous
            </button>
            <button
              className="btn-outline"
              disabled
            >
              Next
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
