/**
 * Production-grade Redis-based rate limiter using Upstash.
 * Works correctly in Vercel serverless — each invocation shares the Redis state.
 *
 * Falls back to in-memory limiter when UPSTASH_REDIS_REST_URL is not set
 * (safe for development, but NOT effective in production serverless).
 */

import type { NextRequest } from 'next/server';

// ── Upstash Redis Rate Limiter ────────────────────────────────────────────────

// Upstash Redis and Ratelimit types are untyped — suppress linting for these declarations
// @ts-ignore
let redisInstance: any = null;
// @ts-ignore
let globalLimiter: any = null;

async function getRedis() {
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

async function getLimiter(): Promise<import('@upstash/ratelimit').Ratelimit | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  if (!globalLimiter) {
    const redis = await getRedis();
    if (!redis) return null;

    const { Ratelimit } = await import('@upstash/ratelimit');
    globalLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
    });
  }

  return globalLimiter;
}

// ── In-Memory Fallback (dev only) ─────────────────────────────────────────────

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

// ── Public API ─────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimitAsync(
  identifier: string,
  requests: number,
  window: string
): Promise<RateLimitResult> {
  const limiter = await getLimiter();

  if (limiter) {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    };
  }

  // Dev fallback — in-memory (not effective in serverless production)
  const windowMs = window === '1 m' ? 60000 : window === '1 h' ? 3600000 : 86400000;
  return checkInMemory(identifier, windowMs, requests);
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

export interface WithRateLimitOptions extends RateLimitOptions {
  keyGenerator?: (req: NextRequest) => string;
}

export function withRateLimit<T = unknown>(
  handler: (req: NextRequest, context?: T) => Promise<Response>,
  options: WithRateLimitOptions
) {
  return async (req: NextRequest, context?: T): Promise<Response> => {
    const { windowMs, maxRequests, keyGenerator } = options;
    const identifier = keyGenerator
      ? keyGenerator(req)
      : req.ip || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    const window = windowMs <= 60000 ? '1 m' : windowMs <= 3600000 ? '1 h' : '1 d';
    const result = await checkRateLimitAsync(identifier, maxRequests, window);

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
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
