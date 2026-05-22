import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { success, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';

const PUBLIC_SETTING_KEYS = [
  'store_name',
  'store_tagline',
  'store_description',
  'whatsapp_number',
  'whatsapp_message_template',
  'instagram_url',
  'facebook_url',
  'tiktok_url',
  'address',
  'city',
  'province',
  'postal_code',
  'contact_email',
  'shipping_origin_city',
  'free_shipping_threshold',
  'min_order_amount',
  'max_order_quantity_per_item',
] as const;

export async function GET(req: NextRequest) {
  try {
    const keysParam = req.nextUrl.searchParams.get('keys');
    let keys: string[];

    if (keysParam) {
      keys = keysParam.split(',').map(k => k.trim()).filter(Boolean);
    } else {
      keys = [...PUBLIC_SETTING_KEYS];
    }

    if (keys.length === 0) {
      return success([]);
    }

    const rows = await db
      .select({
        key: systemSettings.key,
        value: systemSettings.value,
        type: systemSettings.type,
      })
      .from(systemSettings)
      .where(sql`${systemSettings.key} IN (${sql.join(keys.map(k => sql`${k}`), sql`, `)})`);

    const settings = rows.map(s => ({
      key: s.key,
      value: s.type === 'boolean' ? s.value === 'true' : s.type === 'number' ? Number(s.value) : s.value,
    }));

    return success(settings);
  } catch (error) {
    console.error('[PublicSettings/GET]', error);
    return serverError(error);
  }
}