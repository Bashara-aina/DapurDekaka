/**
 * Centralized system settings writer. Upserts a key/value pair in
 * `system_settings` and invalidates the read-side cache.
 */

import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { invalidateSetting } from './get-settings';
import type { SettingType } from './get-settings';

export async function setSetting(
  key: string,
  type: SettingType,
  value: string | number | boolean
): Promise<void> {
  const serialized = type === 'string' ? String(value) : String(value);
  await db
    .insert(systemSettings)
    .values({ key, value: serialized, type })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: serialized, type, updatedAt: sql`NOW()` },
    });
  invalidateSetting(key);
}
