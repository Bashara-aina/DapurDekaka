import { timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';
import { logger } from '@/lib/utils/logger';

function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

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
    logger.error('[cron-auth] CRON_SECRET environment variable is not set');
    return false;
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('[cron-auth] missing or invalid Authorization header');
    return false;
  }

  const token = authHeader.slice(7);
  if (!safeEqualString(token, cronSecret)) {
    logger.warn('[cron-auth] invalid cron token');
    return false;
  }

  return true;
}
