'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Bookmark, User, Calendar } from 'lucide-react';
import { type Template } from '@/lib/firebase/templates';
import { formatDate } from '@/lib/utils';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch } from '@/lib/api/authFetch';

interface TemplateCardProps {
  template: Template;
}

export function TemplateCard({ template }: TemplateCardProps) {
  const [isStarring, setIsStarring] = useState(false);
  const [stars, setStars] = useState(template.stars);
  const [isStarred, setIsStarred] = useState(false);
  const { user } = useAuth();
  const isCurated = template.source === 'serenity_curated' || template.id.startsWith('bundled-');

  const handleStar = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user?.id || isStarring || isCurated) return;
    
    setIsStarring(true);
    try {
      const response = await authenticatedFetch(`/api/templates/${template.id}/star`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setIsStarred(data.starred);
        setStars(data.stars);
      }
    } catch (error) {
      console.error('Error starring template:', error);
    } finally {
      setIsStarring(false);
    }
  };

  // Flat palette tint standing in for a missing thumbnail, picked from the
  // template id so a card keeps the same colour between renders.
  const getPlaceholderTint = () => {
    const tints = ['bg-primary/15', 'bg-secondary/15', 'bg-accent/15', 'bg-warning/15'];
    return tints[template.id.charCodeAt(0) % tints.length];
  };

  return (
    <div className="card group overflow-hidden transition-all hover:shadow-lg">
      {/* Preview Thumbnail */}
      <div className="relative mb-4 h-40 rounded-lg overflow-hidden bg-muted">
        {template.thumbnail ? (
          <Image
            src={template.thumbnail}
            alt={template.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            unoptimized // Data URLs don't need optimization
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center ${getPlaceholderTint()}`}>
            <div className="rounded bg-card/80 px-4 py-2 text-sm font-medium text-foreground">
              Preview
            </div>
          </div>
        )}
        
        {/* Save count and action */}
        <button
          onClick={handleStar}
          disabled={isStarring || !user || isCurated}
          className={`absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium backdrop-blur-sm transition-colors ${
            isStarred 
              ? 'bg-primary/90 text-primary-foreground'
              : 'bg-black/50 text-white hover:bg-black/70'
          }`}
          title={isCurated ? 'Curated by Serenity' : user ? 'Save this template' : 'Sign in to save templates'}
        >
          <Bookmark className={`h-3.5 w-3.5 ${isStarred ? 'fill-current' : ''}`} />
          <span>{stars}</span>
        </button>
      </div>

      {/* Info */}
      <div className="mb-4">
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {template.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        
        <h3 className="font-display text-lg font-semibold line-clamp-1">
          {template.name}
        </h3>
        
        {/* Creator info */}
        <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {template.creatorName || 'Anonymous'}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(template.createdAt)}
          </span>
        </div>
        
        {/* Certificate count */}
        {template.certificateCount > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Used in {template.certificateCount} certificate{template.certificateCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Actions */}
      <Link
        href={`/editor?template=${template.id}&source=public`}
        className="btn-primary w-full text-center"
      >
        Use Template
      </Link>
    </div>
  );
}
