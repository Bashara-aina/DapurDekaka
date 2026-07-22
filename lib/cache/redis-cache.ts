import { logger } from '@/lib/utils/logger';

let redisInstance: unknown = null;

async function getRedis(): Promise<unknown | null> {
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

const CACHE_PREFIX = 'cache:';

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = await getRedis();
    if (!redis) return null;
    const val = await (redis as { get: (k: string) => Promise<string | null> }).get(`${CACHE_PREFIX}${key}`);
    if (!val) return null;
    return JSON.parse(val) as T;
  } catch (err) {
    logger.warn('[cache] get failed', { key, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const redis = await getRedis();
    if (!redis) return;
    const serialized = JSON.stringify(value);
    await (redis as { set: (k: string, v: string, opts: { ex: number }) => Promise<unknown> }).set(
      `${CACHE_PREFIX}${key}`,
      serialized,
      { ex: ttlSeconds }
    );
  } catch (err) {
    logger.warn('[cache] set failed', { key, error: err instanceof Error ? err.message : String(err) });
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    const redis = await getRedis();
    if (!redis) return;
    await (redis as { del: (k: string) => Promise<unknown> }).del(`${CACHE_PREFIX}${key}`);
  } catch (err) {
    logger.warn('[cache] delete failed', { key, error: err instanceof Error ? err.message : String(err) });
  }
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  try {
    const redis = await getRedis();
    if (!redis) return;
    const r = redis as { keys: (p: string) => Promise<string[]>; del: (...k: string[]) => Promise<unknown> };
    const keys = await r.keys(`${CACHE_PREFIX}${pattern}`);
    if (keys.length > 0) {
      await r.del(...keys);
    }
  } catch (err) {
    logger.warn('[cache] deletePattern failed', { pattern, error: err instanceof Error ? err.message : String(err) });
  }
}

const stampedeLocks = new Map<string, number>();

export async function withStampedeLock<T>(
  key: string,
  ttlSeconds: number,
  fetch: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;

  const lockKey = `lock:${key}`;
  const now = Date.now();
  const lockExpiry = stampedeLocks.get(lockKey) ?? 0;

  if (now < lockExpiry) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const retry = await cacheGet<T>(key);
    if (retry !== null) return retry;
  }

  stampedeLocks.set(lockKey, now + 5000);

  try {
    const value = await fetch();
    await cacheSet(key, value, ttlSeconds);
    return value;
  } finally {
    stampedeLocks.delete(lockKey);
  }
}
