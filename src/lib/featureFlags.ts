/**
 * Public feature flags.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so these can be read
 * from both server and client components.
 *
 * Events is complete and authenticated but has not been verified on
 * staging, so it is disabled by default. Set NEXT_PUBLIC_EVENTS_ENABLED
 * to "true" only in an environment where the events flow has been tested.
 * When disabled: no public event promotion/links are shown and the
 * /events route returns not-found; the authenticated API is unaffected.
 */
export const EVENTS_ENABLED = process.env.NEXT_PUBLIC_EVENTS_ENABLED === 'true';
