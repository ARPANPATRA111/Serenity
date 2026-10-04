import { describe, expect, test } from 'vitest';
import { parseEventInput } from '../src/lib/events/validation';

describe('event input validation', () => {
  test('keeps event creation lightweight by requiring only a name', () => {
    const result = parseEventInput({ name: 'Community Workshop', type: 'Workshop' });
    expect(result.error).toBeUndefined();
    expect(result.event).toMatchObject({
      name: 'Community Workshop',
      type: 'Workshop',
      galleryImageUrls: [],
      links: [],
      tags: [],
    });
  });

  test('normalizes URLs and rejects an inverted date range', () => {
    expect(parseEventInput({
      name: 'Invalid schedule',
      startAt: '2026-07-18T10:00:00.000Z',
      endAt: '2026-07-17T10:00:00.000Z',
    }).error).toMatch(/end time/i);

    const valid = parseEventInput({
      name: 'Linked event',
      websiteUrl: 'https://example.com/event',
      links: [{ label: 'Results', url: 'https://example.com/results' }],
    });
    expect(valid.event?.websiteUrl).toBe('https://example.com/event');
    expect(valid.event?.links).toHaveLength(1);
  });
});
