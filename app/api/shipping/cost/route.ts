import { NextRequest } from 'next/server';
import { ALLOWED_COURIERS, MIN_WEIGHT_GRAM, RAJAONGKIR_STARTER_ORIGIN_ID } from '@/lib/constants/couriers';
import { success, serverError, validationError } from '@/lib/utils/api-response';
import { z } from 'zod';
import { getSetting, getSettings } from '@/lib/settings/get-settings';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/utils/rate-limit';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * RajaOngkir Starter tier weight limit.
 * Requests above this are rejected with a helpful message.
 */
const RAJAONGKIR_STARTER_WEIGHT_LIMIT_KG = 30;

const costSchema = z.object({
  destination: z
    .string()
    .min(1, 'Destination city ID diperlukan')
    .regex(/^\d+$/, 'Destination city ID harus berupa angka'),
  weight: z.number().int().positive().max(30000, 'Berat maksimal 30 kg untuk pengiriman frozen'),
});

// Simple in-memory cache for this route handler (60s TTL)
let settingsCache: { data: Record<string, string>; expiresAt: number } | null = null;
const SETTINGS_CACHE_TTL_MS = 60_000;

async function getCachedSettings(keys: string[]): Promise<Record<string, string>> {
  if (settingsCache && settingsCache.expiresAt > Date.now()) {
    return settingsCache.data;
  }
  const data = await getSettings(keys);
  settingsCache = { data, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS };
  return data;
}

export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const parsed = costSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { destination, weight } = parsed.data;
    const billableWeight = Math.max(weight, MIN_WEIGHT_GRAM);
    // RajaOngkir Starter API expects weight in grams
    const weightInGrams = Math.ceil(billableWeight / 100) * 100;

    // Batch-fetch all settings in one DB query
    const settings = await getCachedSettings(['rajaongkir_origin_city_id', 'store_whatsapp_number']);

    const apiKey = process.env.RAJAONGKIR_API_KEY;
    if (!apiKey) {
      return serverError(new Error('RajaOngkir API not configured'));
    }

    // RajaOngkir Starter only supports origin 501 (Jakarta). Hardcode to prevent API errors.
    const origin = RAJAONGKIR_STARTER_ORIGIN_ID;
    const waNumber = settings.store_whatsapp_number ?? process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '6281234567890';

    // Weight limit guard — RajaOngkir Starter API caps at 30kg
    if (weightInGrams > RAJAONGKIR_STARTER_WEIGHT_LIMIT_KG * 1000) {
      return success({
        services: [],
        message: 'Maaf, berat pesanan melebihi batas pengiriman frozen (30 kg). Silakan hubungi kami via WhatsApp untuk solusi pengiriman khusus.',
        whatsappUrl: `https://wa.me/${waNumber}`,
      });
    }

    const results = [];

    for (const courier of ALLOWED_COURIERS) {
      try {
        const response = await fetch('https://api.rajaongkir.com/starter/cost', {
          method: 'POST',
          headers: {
            'key': apiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            origin,
            destination,
            weight: weightInGrams,
            courier: courier.code,
          }),
        });

        const data = await response.json();

        if (data.rajaongkir?.results?.[0]?.costs) {
          const courierData = data.rajaongkir.results[0];

          for (const cost of courierData.costs) {
            if (cost.service === courier.service) {
              results.push({
                courier: courier.code,
                service: cost.service,
                displayName: courier.displayName,
                cost: cost.cost[0].value,
                estimatedDays: cost.cost[0].etd,
                note: cost.cost[0].note,
              });
            }
          }
        }
      } catch (e) {
        logger.error(`[RajaOngkir] Error for ${courier.code}`, { error: e instanceof Error ? e.message : String(e) });
      }
    }

    if (results.length === 0) {
      return success({
        services: [],
        message: 'Mohon maaf, layanan pengiriman frozen ke daerah Anda belum tersedia. Silakan hubungi kami via WhatsApp untuk solusi pengiriman khusus.',
        whatsappUrl: `https://wa.me/${waNumber}`,
      });
    }

    return success({ services: results });

  } catch (error) {
    logger.error('[shipping/cost]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}, { windowMs: 60000, maxRequests: 20 });
