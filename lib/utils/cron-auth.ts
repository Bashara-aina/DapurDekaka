import { NextRequest } from 'next/server';

/**
 * Verify cron job authentication using Bearer token.
 * CRON_SECRET env var must be set and match the Authorization header.
 * Skips verification in development mode.
 */
export function verifyCronAuth(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[CronAuth] CRON_SECRET environment variable is not set');
    return false;
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[CronAuth] Missing or invalid Authorization header');
    return false;
  }

  const token = authHeader.slice(7);
  if (token !== cronSecret) {
    console.warn('[CronAuth] Invalid cron token');
    return false;
  }

  return true;
}