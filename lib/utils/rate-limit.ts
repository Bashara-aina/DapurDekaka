import { NextRequest } from 'next/server';

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limiter using Map with TTL cleanup.
 * Use for development/testing; use Redis-based limiter in production.
 */
class InMemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly defaultWindowMs = 60000) {
    if (process.env.NODE_ENV === 'production') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }

  check(key: string, windowMs: number, maxRequests: number): RateLimitResult {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetAt <= now) {
      const resetAt = now + windowMs;
      this.store.set(key, { count: 1, resetAt });
      return { success: true, remaining: maxRequests - 1, resetAt };
    }

    if (entry.count >= maxRequests) {
      return { success: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { success: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

const globalRateLimiter = new InMemoryRateLimiter();

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

export function checkRateLimit(
  key: string,
  { windowMs, maxRequests }: RateLimitOptions
): RateLimitResult {
  return globalRateLimiter.check(key, windowMs, maxRequests);
}

type MiddlewareHandler<T = unknown> = (
  request: NextRequest,
  context?: T
) => Promise<Response> | Response;

export interface WithRateLimitOptions extends RateLimitOptions {
  keyGenerator?: (req: NextRequest) => string;
}

/**
 * Rate limit middleware wrapper for API routes.
 */
export function withRateLimit<T = unknown>(
  handler: MiddlewareHandler<T>,
  options: WithRateLimitOptions
) {
  return async (req: NextRequest, context?: T): Promise<Response> => {
    const { windowMs, maxRequests, keyGenerator } = options;
    const key = keyGenerator
      ? keyGenerator(req)
      : req.ip || req.headers.get('x-forwarded-for') || 'unknown';

    const result = checkRateLimit(key, { windowMs, maxRequests });

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
            'X-RateLimit-Remaining': '0',
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