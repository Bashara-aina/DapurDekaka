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

const processedLocal = new Set<string>();
const LOCAL_TTL_MS = 60_000;

function cleanLocal(): void {
  if (processedLocal.size > 1000) {
    processedLocal.clear();
  }
}

export async function isAlreadyProcessed(idempotencyKey: string): Promise<boolean> {
  if (processedLocal.has(idempotencyKey)) return true;

  try {
    const redis = await getRedis();
    if (redis) {
      const exists = await (redis as { exists: (k: string) => Promise<number> }).exists(`idempotent:${idempotencyKey}`);
      if (exists === 1) return true;
    }
  } catch (err) {
    logger.warn('[idempotency] redis check failed', {
      key: idempotencyKey,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return false;
}

export async function markProcessed(idempotencyKey: string, ttlSeconds = 86400): Promise<void> {
  processedLocal.add(idempotencyKey);
  cleanLocal();
  setTimeout(() => processedLocal.delete(idempotencyKey), LOCAL_TTL_MS);

  try {
    const redis = await getRedis();
    if (redis) {
      await (redis as { set: (k: string, v: string, opts: { ex: number }) => Promise<unknown> }).set(
        `idempotent:${idempotencyKey}`,
        '1',
        { ex: ttlSeconds }
      );
    }
  } catch (err) {
    logger.warn('[idempotency] redis set failed', {
      key: idempotencyKey,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function buildWebhookIdempotencyKey(source: string, externalId: string, eventType: string): string {
  return `${source}:${externalId}:${eventType}`;
}
