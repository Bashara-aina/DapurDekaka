/**
 * Canonical site origin (HIGH-3). `www` is the canonical host; the apex
 * redirects to it permanently (next.config.mjs). Never hardcode the host.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.dapurdekaka.com'
).replace(/\/$/, '');
