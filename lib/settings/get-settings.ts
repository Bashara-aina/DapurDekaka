/**
 * Centralized system settings reader.
 *
 * The `system_settings` table is small and read on almost every page, so the
 * whole table is loaded in ONE query and kept as a snapshot for 5 minutes per
 * instance. Misses (keys that do not exist) are part of the snapshot too, so a
 * missing key never triggers another query. Concurrent cold reads share a
 * single in-flight query.
 *
 * Usage:
 *   const whatsapp = await getSetting('store_whatsapp_number');
 *   const expiry = await getSetting<number>('payment_expiry_minutes', 'integer');
 */

import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';

// ── Types ────────────────────────────────────────────────────────────────────

export type SettingType = 'string' | 'integer' | 'boolean' | 'number';

// ── Snapshot cache ───────────────────────────────────────────────────────────

const SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Raw string values keyed by setting key (type coercion happens on read). */
let snapshot: Map<string, string> = new Map();
let snapshotExpiresAt = 0;
let inflight: Promise<Map<string, string>> | null = null;

function isSnapshotValid(): boolean {
  return snapshotExpiresAt > Date.now();
}

async function loadSnapshot(): Promise<Map<string, string>> {
  if (isSnapshotValid()) return snapshot;
  if (!inflight) {
    inflight = db
      .select({ key: systemSettings.key, value: systemSettings.value })
      .from(systemSettings)
      .then((rows) => {
        const next = new Map<string, string>();
        for (const row of rows) next.set(row.key, row.value);
        snapshot = next;
        snapshotExpiresAt = Date.now() + SNAPSHOT_TTL_MS;
        return next;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get a single setting value (served from the whole-table snapshot).
 *
 * @param key          The setting key (e.g. 'store_whatsapp_number')
 * @param typeHint     Optional type hint for coercion: 'string' | 'integer' | 'boolean' | 'number'
 *                     Defaults to 'string' for backward compatibility.
 */
export async function getSetting<T = string>(
  key: string,
  typeHint?: SettingType
): Promise<T | null> {
  const map = await loadSnapshot();
  const raw = map.get(key);
  if (raw === undefined) return null;
  return coerceValue(raw, typeHint ?? 'string') as T;
}

/**
 * Get multiple settings (one shared snapshot read).
 *
 * @param keys  Array of setting keys to fetch
 * @returns    Record of key → value (only keys that exist in DB)
 */
export async function getSettings(
  keys: string[]
): Promise<Record<string, string>> {
  const map = await loadSnapshot();
  const result: Record<string, string> = {};
  for (const key of keys) {
    const value = map.get(key);
    if (value !== undefined) result[key] = value;
  }
  return result;
}

/**
 * Invalidate the snapshot after an admin update, so the next read hits the DB.
 * The snapshot is small, so a single key change expires the whole snapshot.
 */
export function invalidateSetting(_key: string): void {
  snapshotExpiresAt = 0;
}

/**
 * Invalidate ALL cached settings.
 */
export function invalidateAllSettings(): void {
  snapshotExpiresAt = 0;
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
