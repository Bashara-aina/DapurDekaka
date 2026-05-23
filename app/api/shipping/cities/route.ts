import { NextRequest } from 'next/server';
import { getCitiesByProvince } from '@/lib/rajaongkir/cities';
import { z } from 'zod';
import { success, validationError, serverError, badRequest } from '@/lib/utils/api-response';
import { checkRateLimitAsync } from '@/lib/utils/rate-limit';
import { logger } from '@/lib/utils/logger';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const querySchema = z.object({
  provinceId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const ip = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const rateLimit = await checkRateLimitAsync(ip, 30, '1 m');
  if (!rateLimit.success) {
    return badRequest('Terlalu banyak permintaan. Silakan coba lagi nanti.');
  }

  try {
    const { searchParams } = req.nextUrl;
    const provinceId = searchParams.get('provinceId');

    const parsed = querySchema.safeParse({ provinceId });
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const cities = await getCitiesByProvince(parsed.data.provinceId);
    return success(cities);
  } catch (error) {
    logger.error('[API/shipping/cities]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}