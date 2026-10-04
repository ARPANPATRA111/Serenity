'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';

/**
 * Renders a date in the viewer's time zone. The server renders the UTC date so
 * the page is complete without JavaScript; after hydration the viewer's local
 * date replaces it, which matters for certificates issued near midnight.
 */
export function LocalDate({ value }: { value: string }) {
  const [label, setLabel] = useState(() => formatDate(value, { timeZone: 'UTC' }));

  useEffect(() => {
    setLabel(formatDate(value));
  }, [value]);

  return (
    <time dateTime={value} suppressHydrationWarning>
      {label}
    </time>
  );
}
