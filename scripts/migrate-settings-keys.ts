/**
 * One-shot migration: copy legacy UPPERCASE / alternate settings keys to canonical snake_case,
 * then insert missing canonical defaults with onConflictDoNothing.
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import * as schema from '../lib/db/schema';
import { SETTING_KEYS } from '../lib/settings/canonical-keys';

if (!process.env.DATABASE_URL) {
  console.error('ABORT: DATABASE_URL is not set.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

/** Legacy key → canonical key (copy value only when canonical is absent). */
const KEY_ALIASES: ReadonlyArray<{ from: string; to: string }> = [
  { from: 'PROMO_CODE', to: SETTING_KEYS.PROMO_CODE },
  { from: 'PROMO_TITLE', to: SETTING_KEYS.PROMO_TITLE },
  { from: 'PROMO_SUBTITLE', to: SETTING_KEYS.PROMO_SUBTITLE },
  { from: 'CAROUSEL_SPEED_MS', to: SETTING_KEYS.CAROUSEL_SPEED_MS },
  { from: 'whatsapp_number', to: SETTING_KEYS.STORE_WHATSAPP_NUMBER },
];

interface DefaultSetting {
  key: string;
  value: string;
  type: string;
}

const CANONICAL_DEFAULTS: readonly DefaultSetting[] = [
  { key: SETTING_KEYS.PROMO_ACTIVE, value: 'true', type: 'boolean' },
  { key: SETTING_KEYS.PROMO_CODE, value: 'SELAMATDATANG', type: 'string' },
  { key: SETTING_KEYS.PROMO_TITLE, value: 'Untuk pembelian pertama kamu', type: 'string' },
  { key: SETTING_KEYS.PROMO_SUBTITLE, value: 'Gunakan kode:', type: 'string' },
  { key: SETTING_KEYS.CAROUSEL_SPEED_MS, value: '5000', type: 'integer' },
  {
    key: SETTING_KEYS.STORE_WHATSAPP_NUMBER,
    value: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '6289673737886',
    type: 'string',
  },
  { key: SETTING_KEYS.STORE_NAME, value: 'Dapur Dekaka', type: 'string' },
  { key: SETTING_KEYS.STORE_ADDRESS, value: 'Jl. Sinom V No. 7, Turangga, Bandung, Jawa Barat', type: 'string' },
  { key: SETTING_KEYS.STORE_OPENING_HOURS, value: '09:00 - 17:00 WIB', type: 'string' },
  { key: SETTING_KEYS.STORE_OPEN_DAYS, value: 'Senin - Sabtu', type: 'string' },
  { key: SETTING_KEYS.STORE_SUNDAY_HOURS, value: '09:00 - 15:00 WIB', type: 'string' },
  { key: SETTING_KEYS.INSTAGRAM_HANDLE, value: '@dapurdekaka', type: 'string' },
  {
    key: SETTING_KEYS.INSTAGRAM_URL,
    value: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? 'https://instagram.com/dapurdekaka',
    type: 'string',
  },
  { key: SETTING_KEYS.OG_IMAGE_PUBLIC_ID, value: 'dapurdekaka/og-image', type: 'string' },
  { key: SETTING_KEYS.ADMIN_EMAIL, value: process.env.SEED_ADMIN_EMAIL ?? 'bashara@dapurdekaka.com', type: 'string' },
  { key: SETTING_KEYS.FOUNDING_YEAR, value: '2020', type: 'integer' },
  { key: SETTING_KEYS.PRICE_RANGE_MIN, value: '30000', type: 'integer' },
  { key: SETTING_KEYS.PRICE_RANGE_MAX, value: '200000', type: 'integer' },
  { key: SETTING_KEYS.SOFT_LAUNCH_BANNER, value: 'true', type: 'boolean' },
  {
    key: SETTING_KEYS.SOFT_LAUNCH_WA_MESSAGE,
    value: 'Halo Dapur Dekaka, saya ingin tahu promo soft launch.',
    type: 'string',
  },
  {
    key: SETTING_KEYS.WA_DEFAULT_MESSAGE,
    value: 'Halo Dapur Dekaka! Saya ingin bertanya tentang produk.',
    type: 'string',
  },
];

async function copyAlias(from: string, to: string): Promise<boolean> {
  const [source] = await db
    .select()
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, from))
    .limit(1);

  if (!source) {
    console.log(`  Skip alias ${from} → ${to}: source not found.`);
    return false;
  }

  const [target] = await db
    .select({ key: schema.systemSettings.key })
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, to))
    .limit(1);

  if (target) {
    console.log(`  Skip alias ${from} → ${to}: "${to}" already exists.`);
    return false;
  }

  await db.insert(schema.systemSettings).values({
    key: to,
    value: source.value,
    type: source.type,
    description: source.description,
    updatedBy: source.updatedBy,
  });

  console.log(`  Copied ${from} → ${to}.`);
  return true;
}

async function insertDefaults(): Promise<number> {
  let inserted = 0;

  for (const setting of CANONICAL_DEFAULTS) {
    const result = await db
      .insert(schema.systemSettings)
      .values({
        key: setting.key,
        value: setting.value,
        type: setting.type,
      })
      .onConflictDoNothing({ target: schema.systemSettings.key })
      .returning({ key: schema.systemSettings.key });

    if (result.length > 0) {
      inserted += 1;
      console.log(`  Inserted default: ${setting.key}`);
    }
  }

  return inserted;
}

async function migrateSettingsKeys(): Promise<void> {
  console.log('Starting settings key migration...');

  console.log('Copying legacy aliases...');
  let copied = 0;
  for (const alias of KEY_ALIASES) {
    const didCopy = await copyAlias(alias.from, alias.to);
    if (didCopy) copied += 1;
  }
  console.log(`  Aliases copied: ${copied}/${KEY_ALIASES.length}`);

  console.log('Inserting missing canonical defaults...');
  const inserted = await insertDefaults();
  console.log(`  Defaults inserted: ${inserted}`);

  console.log('Settings key migration completed.');
}

migrateSettingsKeys().catch((err: unknown) => {
  console.error('Settings migration failed:', err);
  process.exit(1);
});
