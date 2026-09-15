import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { success, serverError, badRequest } from '@/lib/utils/api-response';
import { checkRateLimitAsync } from '@/lib/utils/rate-limit';
import { PUBLIC_SETTING_KEYS } from '@/lib/settings/canonical-keys';

export const revalidate = 600;
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const ip = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const rateLimit = await checkRateLimitAsync(ip, 'public');
  if (!rateLimit.success) {
    return badRequest('Terlalu banyak permintaan. Silakan coba lagi nanti.');
  }

  try {
    const keys = [...PUBLIC_SETTING_KEYS];
    const settings = await db.query.systemSettings.findMany({
      where: inArray(systemSettings.key, keys),
    });

    const result = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    // Alias for older clients that still read whatsapp_number
    if (result.store_whatsapp_number && !result.whatsapp_number) {
      result.whatsapp_number = result.store_whatsapp_number;
    }

    return success(result);
  } catch (error) {
    return serverError(error);
  }
}
