import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { success, serverError, badRequest } from '@/lib/utils/api-response';
import { checkRateLimitAsync } from '@/lib/utils/rate-limit';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PUBLIC_SETTING_KEYS = [
  'store_open_days',
  'store_opening_hours',
  'store_closing_hours',
  'whatsapp_number',
  'store_address',
  'store_name',
];

export async function GET(req: NextRequest) {
  const ip = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const rateLimit = await checkRateLimitAsync(ip, 30, '1 m');
  if (!rateLimit.success) {
    return badRequest('Terlalu banyak permintaan. Silakan coba lagi nanti.');
  }

  try {
    const settings = await db.query.systemSettings.findMany({
      where: (s, { inArray: inArrayFn }) => inArrayFn(s.key, PUBLIC_SETTING_KEYS),
    });

    const result = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    return success(result);
  } catch (error) {
    console.error('[api/settings/public]', error);
    return serverError(error);
  }
}