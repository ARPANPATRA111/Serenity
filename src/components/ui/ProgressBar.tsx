'use client';

import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
  showLabel?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export function ProgressBar({
  value,
  className,
  showLabel = false,
  label,
  size = 'md',
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn('w-full', className)}>
      {(showLabel || label) && (
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{label || 'Progress'}</span>
          <span className="font-medium">{Math.round(clampedValue)}%</span>
        </div>
      )}
      <div className={cn('progress-bar', sizeClasses[size])}>
        <div
          className="progress-bar-fill"
          style={{ width: `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

interface GenerationProgressProps {
  current: number;
  total: number;
  status: string;
  errors?: Array<{ index: number; message: string }>;
  onCancel?: () => void;
}

export function GenerationProgress({
  current,
  total,
  status,
  errors = [],
  onCancel,
}: GenerationProgressProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="w-full space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">Generating Certificates</h4>
          <p className="text-sm text-muted-foreground">{status}</p>
        </div>
        <div className="text-right">
          <span className="font-display text-2xl font-bold text-primary">
            {current}
          </span>
          <span className="text-muted-foreground"> / {total}</span>
        </div>
      </div>

      <ProgressBar value={percentage} size="lg" />

      {errors.length > 0 && (
        <div className="rounded-lg bg-red-500/10 p-3">
          <p className="text-sm font-medium text-red-500">
            {errors.length} error{errors.length > 1 ? 's' : ''} encountered
          </p>
          <ul className="mt-1 text-xs text-red-400">
            {errors.slice(0, 3).map((err) => (
              <li key={err.index}>Row {err.index + 1}: {err.message}</li>
            ))}
            {errors.length > 3 && (
              <li>...and {errors.length - 3} more</li>
            )}
          </ul>
        </div>
      )}

      {onCancel && (
        <button
          onClick={onCancel}
          className="w-full rounded-lg border border-border py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          Cancel Generation
        </button>
      )}
    </div>
  );
}
