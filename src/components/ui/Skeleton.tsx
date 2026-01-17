'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className
      )}
    />
  );
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 space-y-4', className)}>
      {/* Thumbnail */}
      <Skeleton className="h-32 w-full rounded-lg" />
      {/* Title */}
      <Skeleton className="h-5 w-3/4" />
      {/* Subtitle */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  );
}

export function SkeletonTemplateGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-border">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

export function SkeletonActivityList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTableRow key={i} />
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      {/* Stats */}
      <SkeletonStats />

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Templates Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>

        {/* Activity Section */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-28" />
          <div className="rounded-xl border border-border bg-card p-4">
            <SkeletonActivityList count={5} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonTemplatesPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border pb-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>

      {/* Grid */}
      <SkeletonTemplateGrid count={8} />
    </div>
  );
}

export function SkeletonHistoryPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Table Header */}
      <div className="flex items-center gap-4 py-3 border-b-2 border-border">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Table Rows */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-4 border-b border-border">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonSettingsPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Skeleton className="h-8 w-32" />
      
      {/* Sections */}
      {[1, 2, 3].map((section) => (
        <div key={section} className="rounded-xl border border-border bg-card p-6 space-y-6">
          <Skeleton className="h-6 w-40" />
          <div className="space-y-4">
            {[1, 2, 3].map((field) => (
              <div key={field} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
