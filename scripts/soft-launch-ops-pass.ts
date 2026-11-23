/**
 * Soft-launch ops pass: deactivate unusable free-shipping coupons, align promo
 * settings, confirm store settings presence. Does not flip Midtrans/Biteship live.
 */
import { db } from '../lib/db';
import { coupons, systemSettings } from '../lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function upsertSetting(key: string, type: string, value: string): Promise<void> {
  const existing = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, key),
  });
  if (existing) {
    await db
      .update(systemSettings)
      .set({ value, type, updatedAt: sql`now()` })
      .where(eq(systemSettings.key, key));
  } else {
    await db.insert(systemSettings).values({ key, type, value });
  }
  console.log(`setting ${key}=${value}`);
}

async function main(): Promise<void> {
  const freeShip = await db.query.coupons.findMany({
    where: eq(coupons.type, 'free_shipping'),
  });
  for (const c of freeShip) {
    if (c.isActive) {
      await db
        .update(coupons)
        .set({ isActive: false, updatedAt: sql`now()` })
        .where(eq(coupons.id, c.id));
      console.log(`deactivated free_shipping coupon ${c.code}`);
    }
  }

  // Keep soft launch banner on; maintenance off; promo points defaults intentional.
  await upsertSetting('maintenance_mode', 'boolean', 'false');
  await upsertSetting('soft_launch_banner_enabled', 'boolean', 'true');
  await upsertSetting('payment_expiry_minutes', 'integer', '15');
  await upsertSetting('payment_max_retries', 'integer', '3');
  await upsertSetting('b2b_points_multiplier', 'integer', '1');
  await upsertSetting('carousel_speed_ms', 'integer', '5000');

  const keys = [
    'store_name',
    'store_whatsapp_number',
    'store_address',
    'admin_email',
    'biteship_origin_lat',
    'biteship_origin_lng',
    'biteship_origin_address',
    'biteship_origin_postal_code',
    'promo_code',
    'promo_active',
    'instagram_url',
    'instagram_handle',
  ];
  for (const key of keys) {
    const row = await db.query.systemSettings.findFirst({ where: eq(systemSettings.key, key) });
    console.log(`check ${key}:`, row ? `${row.value.slice(0, 60)}` : 'MISSING');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
