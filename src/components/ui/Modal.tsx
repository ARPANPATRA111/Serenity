'use client';

import { ReactNode, useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from './Button';

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  showCloseButton = true,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus moves into the dialog when it opens, Tab stays inside it, and focus
  // returns to whatever opened it when it closes.
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(contentRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
      .filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);

    const first = focusable().find((element) => element.getAttribute('aria-label') !== 'Close modal') ?? focusable()[0];
    (first ?? contentRef.current)?.focus({ preventScroll: true });

    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        contentRef.current?.focus();
        return;
      }
      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];
      const active = document.activeElement;
      if (!contentRef.current?.contains(active)) {
        event.preventDefault();
        firstElement.focus();
      } else if (event.shiftKey && active === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && active === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };
    document.addEventListener('keydown', trapTab);
    return () => {
      document.removeEventListener('keydown', trapTab);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close when clicking overlay
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div ref={contentRef} tabIndex={-1} className={cn('modal-content focus:outline-none', className)}>
        {(title || showCloseButton) && (
          <div className="mb-4 flex items-start justify-between">
            <div>
              {title && (
                <h2 id={titleId} className="font-display text-lg font-semibold">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  description?: string;
  onNotifyMe?: () => void;
}

export function ComingSoonModal({
  isOpen,
  onClose,
  feature,
  description,
  onNotifyMe,
}: ComingSoonModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-md text-center"
    >
      <div className="py-4">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <svg
            className="h-8 w-8 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            />
          </svg>
        </div>

        <h3 className="font-display text-xl font-bold">{feature}</h3>
        <p className="mt-2 text-muted-foreground">
          {description || 'This feature is coming soon with Serenity Pro!'}
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {onNotifyMe && (
            <Button onClick={onNotifyMe} className="w-full">
              Notify Me When Available
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="w-full">
            Maybe Later
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Billing and paid-plan upgrades are not currently available.
        </p>
      </div>
    </Modal>
  );
}
