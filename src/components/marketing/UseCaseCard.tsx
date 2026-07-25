import type { LucideIcon } from 'lucide-react';

export function UseCaseCard({
  icon: Icon,
  audience,
  body,
}: {
  icon: LucideIcon;
  audience: string;
  body: string;
}) {
  return (
    <article className="sr-card sr-card-lift h-full p-6">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[rgb(var(--sr-brand-wash))] text-[rgb(var(--sr-brand))]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="sr-h3 mt-5">{audience}</h3>
      <p className="sr-body mt-2">{body}</p>
    </article>
  );
}
