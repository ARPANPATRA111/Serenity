'use client';

import { useId, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { GoogleMark } from './GoogleMark';

export function AuthMessage({
  tone,
  children,
}: {
  tone: 'error' | 'success';
  children: ReactNode;
}) {
  const isError = tone === 'error';
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <p
      role={isError ? 'alert' : 'status'}
      className={`sr-notice ${isError ? 'sr-notice-error' : 'sr-notice-success'}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function ProviderButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="sr-btn sr-btn-secondary w-full">
      <GoogleMark />
      {label}
    </button>
  );
}

export function FormField({
  id,
  label,
  hint,
  action,
  ...input
}: {
  id: string;
  label: string;
  hint?: string;
  action?: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const hintId = `${id}-hint`;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="sr-field-label">
          {label}
        </label>
        {action}
      </div>
      <input id={id} className="sr-input" aria-describedby={hint ? hintId : undefined} {...input} />
      {hint && (
        <span id={hintId} className="sr-hint sr-hint-reserved mt-1.5">
          {hint}
        </span>
      )}
    </div>
  );
}

export function PasswordField({
  id,
  label,
  hint,
  action,
  ...input
}: {
  id: string;
  label: string;
  hint?: string;
  action?: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const hintId = useId();

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="sr-field-label">
          {label}
        </label>
        {action}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="sr-input pr-12"
          aria-describedby={hint ? hintId : undefined}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-[var(--sr-r-md)] text-[rgb(var(--sr-ink-faint))] hover:text-[rgb(var(--sr-ink))]"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && (
        <span id={hintId} className="sr-hint sr-hint-reserved mt-1.5">
          {hint}
        </span>
      )}
    </div>
  );
}
