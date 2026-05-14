/**
 * Rate limiter using in-memory sliding window
 * (Upstash Redis integration ready when packages are installed)
 */

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  pending?: Promise<RateLimitResult>;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

class SlidingWindowRateLimiter {
  private store = new Map<string, { count: number; resetAt: number }>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async limit(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const { windowMs, max } = this.config;
    const entry = this.store.get(identifier);

    if (!entry || entry.resetAt <= now) {
      const resetAt = now + windowMs;
      this.store.set(identifier, { count: 1, resetAt });
      return {
        success: true,
        limit: max,
        remaining: max - 1,
        reset: resetAt,
      };
    }

    if (entry.count >= max) {
      return {
        success: false,
        limit: max,
        remaining: 0,
        reset: entry.resetAt,
      };
    }

    entry.count++;
    return {
      success: true,
      limit: max,
      remaining: max - entry.count,
      reset: entry.resetAt,
    };
  }
}

const checkoutLimiter = new SlidingWindowRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 });
const couponLimiter = new SlidingWindowRateLimiter({ windowMs: 60 * 1000, max: 10 });
const apiLimiter = new SlidingWindowRateLimiter({ windowMs: 60 * 1000, max: 30 });

export const ratelimit = {
  checkout: checkoutLimiter,
  coupon: couponLimiter,
  api: apiLimiter,
};