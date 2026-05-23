import { NextRequest } from 'next/server';
import { getProvinces } from '@/lib/rajaongkir/provinces';
import { success, serverError, badRequest } from '@/lib/utils/api-response';
import { checkRateLimitAsync } from '@/lib/utils/rate-limit';
import { logger } from '@/lib/utils/logger';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const ip = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const rateLimit = await checkRateLimitAsync(ip, 30, '1 m');
  if (!rateLimit.success) {
    return badRequest('Terlalu banyak permintaan. Silakan coba lagi nanti.');
  }

  try {
    const provinces = await getProvinces();
    return success(provinces);
  } catch (error) {
    logger.error('[API/shipping/provinces]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}