import type { ReactNode } from 'react';
import { Reveal } from './Reveal';

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = 'start',
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  align?: 'start' | 'center';
  children?: ReactNode;
}) {
  const centered = align === 'center';

  return (
    <Reveal className={centered ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="sr-eyebrow">{eyebrow}</p>
      <h2 className="sr-h2 mt-4">{title}</h2>
      {lead && <p className="sr-lead mt-5">{lead}</p>}
      {children}
    </Reveal>
  );
}
