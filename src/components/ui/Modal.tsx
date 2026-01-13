'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from './Button';

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

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

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
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
    >
      <div className={cn('modal-content', className)}>
        {(title || showCloseButton) && (
          <div className="mb-4 flex items-start justify-between">
            <div>
              {title && (
                <h2 id="modal-title" className="font-display text-lg font-semibold">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-description" className="mt-1 text-sm text-muted-foreground">
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

/**
 * Coming Soon Modal - Used for Freemium upsell
 */
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
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent">
          <svg
            className="h-8 w-8 text-white"
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
          Upgrade to Pro for unlimited bulk operations
        </p>
      </div>
    </Modal>
  );
}
