/**
 * Centralized system settings reader with in-memory LRU cache.
 * Reads from the system_settings table and caches for 5 minutes.
 *
 * Usage:
 *   const whatsapp = await getSetting('store_whatsapp_number');
 *   const expiry = await getSetting<number>('payment_expiry_minutes', 'integer');
 */

import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

// ── Types ────────────────────────────────────────────────────────────────────

export type SettingType = 'string' | 'integer' | 'boolean' | 'number';

export interface SettingCache {
  value: unknown;
  expiresAt: number;
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const cache = new Map<string, SettingCache>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isCacheValid(key: string): boolean {
  const entry = cache.get(key);
  return entry !== undefined && entry.expiresAt > Date.now();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get a single setting value from the database (with 5-min cache).
 *
 * @param key          The setting key (e.g. 'store_whatsapp_number')
 * @param typeHint     Optional type hint for coercion: 'string' | 'integer' | 'boolean' | 'number'
 *                     Defaults to 'string' for backward compatibility.
 */
export async function getSetting<T = string>(
  key: string,
  typeHint?: SettingType
): Promise<T | null> {
  if (isCacheValid(key)) {
    return cache.get(key)!.value as T;
  }

  const row = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) return null;

  const coerced = coerceValue(row.value, typeHint ?? 'string');
  cache.set(key, { value: coerced, expiresAt: Date.now() + CACHE_TTL_MS });

  return coerced as T;
}

/**
 * Get multiple settings in a single DB query (still cached per-key).
 *
 * @param keys  Array of setting keys to fetch
 * @returns    Record of key → value (only keys that exist in DB)
 */
export async function getSettings(
  keys: string[]
): Promise<Record<string, string>> {
  const uncached = keys.filter((k) => !isCacheValid(k));

  if (uncached.length > 0) {
    const rows = await db
      .select({ key: systemSettings.key, value: systemSettings.value })
      .from(systemSettings)
      .where(sql`${systemSettings.key} IN (${sql.join(uncached.map((k) => sql`${k}`), sql`, `)})`);

    for (const row of rows) {
      cache.set(row.key, { value: row.value, expiresAt: Date.now() + CACHE_TTL_MS });
    }
  }

  const result: Record<string, string> = {};
  for (const key of keys) {
    const entry = cache.get(key);
    if (entry) result[key] = entry.value as string;
  }
  return result;
}

/**
 * Invalidate the cache for a specific key.
 * Call this after admin updates a setting so the next read hits DB.
 */
export function invalidateSetting(key: string): void {
  cache.delete(key);
}

/**
 * Invalidate ALL cached settings.
 */
export function invalidateAllSettings(): void {
  cache.clear();
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function coerceValue(value: string, type: SettingType): unknown {
  switch (type) {
    case 'integer':
    case 'number':
      return parseInt(value, 10);
    case 'boolean':
      return value === 'true' || value === '1';
    default:
      return value;
  }
}