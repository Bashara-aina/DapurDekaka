import type { NextRequest } from 'next/server';
import { logger } from '@/lib/utils/logger';

export type RateLimitTier =
  | 'auth'       // login, register, forgot/reset-password → 5/15min
  | 'money'      // checkout, coupon, points → 10/min
  | 'public'     // catalog, product, blog → 120/min (or CDN handles)
  | 'webhook'    // midtrans, biteship → no user limit, verified by signature
  | 'admin'      // admin endpoints → 60/min
  | 'cron';      // /api/cron/* → CRON_SECRET gate, not rate-limited

interface TierConfig {
  maxRequests: number;
  windowMs: number;
}

const TIER_CONFIGS: Record<RateLimitTier, TierConfig> = {
  auth:   { maxRequests: 5,  windowMs: 15 * 60 * 1000 },
  money:  { maxRequests: 10, windowMs: 60 * 1000 },
  public: { maxRequests: 120, windowMs: 60 * 1000 },
  webhook: { maxRequests: 60, windowMs: 60 * 1000 },
  admin:   { maxRequests: 60, windowMs: 60 * 1000 },
  cron:    { maxRequests: 9999, windowMs: 60 * 1000 },
};

let redisInstance: unknown = null;

function validateRedisConfig(): void {
  const hasUrl = Boolean(process.env.UPSTASH_REDIS_REST_URL);
  const hasToken = Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

  if (process.env.NODE_ENV === 'production') {
    if (!hasUrl || !hasToken) {
      throw new Error(
        'Rate limiting requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in production'
      );
    }
  } else if (!hasUrl || !hasToken) {
    console.warn(
      '[RateLimit] Upstash Redis not configured. Falls back to in-memory (dev only).'
    );
  }
}

async function getRedis(): Promise<unknown | null> {
  validateRedisConfig();
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redisInstance) {
    const { Redis } = await import('@upstash/redis');
    redisInstance = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redisInstance;
}

const limiters = new Map<string, unknown>();

async function getTierLimiter(tier: RateLimitTier): Promise<unknown | null> {
  validateRedisConfig();
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!limiters.has(tier)) {
    const redis = await getRedis();
    if (!redis) return null;
    const { Ratelimit } = await import('@upstash/ratelimit');
    const cfg = TIER_CONFIGS[tier];
    limiters.set(tier, new Ratelimit({
      redis: redis as never,
      limiter: Ratelimit.slidingWindow(cfg.maxRequests, `${cfg.windowMs}ms`),
      analytics: true,
      prefix: `ratelimit:${tier}`,
    }));
  }
  return limiters.get(tier)!;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const inMemoryStore = new Map<string, RateLimitEntry>();

function checkInMemory(key: string, windowMs: number, maxRequests: number) {
  const now = Date.now();
  const entry = inMemoryStore.get(key);
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    inMemoryStore.set(key, { count: 1, resetAt });
    return { success: true, remaining: maxRequests - 1, resetAt };
  }
  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count++;
  return { success: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export function getKeyForTier(req: NextRequest, tier: RateLimitTier): string {
  if (tier === 'cron') return 'cron';
  if (tier === 'webhook') return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'webhook';
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

export async function checkRateLimitAsync(
  identifier: string,
  tier: RateLimitTier
): Promise<RateLimitResult> {
  const cfg = TIER_CONFIGS[tier];
  const limiter = await getTierLimiter(tier);

  if (limiter) {
    const result = await (limiter as { limit: (id: string) => Promise<{ success: boolean; remaining: number; reset: number }> }).limit(identifier);
    return { success: result.success, remaining: result.remaining, resetAt: result.reset };
  }

  return checkInMemory(identifier, cfg.windowMs, cfg.maxRequests);
}

export function withRateLimit<T = unknown>(
  handler: (req: NextRequest, context?: T) => Promise<Response>,
  tier: RateLimitTier
) {
  return async (req: NextRequest, context?: T): Promise<Response> => {
    if (tier === 'cron') return handler(req, context);

    const identifier = getKeyForTier(req, tier);
    const result = await checkRateLimitAsync(identifier, tier);

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: tier === 'auth'
            ? 'Terlalu banyak percobaan. Silakan coba lagi nanti.'
            : tier === 'money'
              ? 'Terlalu banyak permintaan. Silakan coba lagi nanti.'
              : 'Terlalu banyak permintaan. Silakan coba lagi.',
          code: 'RATE_LIMITED',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Remaining': String(result.remaining),
            'X-RateLimit-Reset': String(result.resetAt),
          },
        }
      );
    }

    const response = await handler(req, context);
    if (response.headers) {
      response.headers.set('X-RateLimit-Remaining', String(result.remaining));
      response.headers.set('X-RateLimit-Reset', String(result.resetAt));
    }
    return response;
  };
}
