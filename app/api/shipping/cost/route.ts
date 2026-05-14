import { NextRequest, NextResponse } from 'next/server';
import { ALLOWED_COURIERS, MIN_WEIGHT_GRAM } from '@/lib/constants/couriers';
import { success, serverError, validationError } from '@/lib/utils/api-response';
import { z } from 'zod';
import { getSetting } from '@/lib/settings/get-settings';

const costSchema = z.object({
  destination: z.string(),
  weight: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = costSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { destination, weight } = parsed.data;
    const billableWeight = Math.max(weight, MIN_WEIGHT_GRAM);
    const weightInKg = Math.ceil(billableWeight / 100) * 100;

    const [apiKey, originCityId, whatsappNumber] = await Promise.all([
      Promise.resolve(process.env.RAJAONGKIR_API_KEY),
      getSetting('rajaongkir_origin_city_id'),
      getSetting('store_whatsapp_number'),
    ]);

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'RajaOngkir API not configured',
        code: 'CONFIG_ERROR',
      }, { status: 500 });
    }

    const origin = originCityId ?? '23';
    const waNumber = whatsappNumber ?? process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '6281234567890';

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
            weight: weightInKg,
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
        console.error(`[RajaOngkir] Error for ${courier.code}:`, e);
      }
    }

    if (results.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Mohon maaf, layanan pengiriman frozen ke daerah Anda belum tersedia. Silakan hubungi kami via WhatsApp untuk solusi pengiriman khusus.',
        code: 'NO_SERVICE',
        whatsappUrl: `https://wa.me/${waNumber}`,
      }, { status: 200 });
    }

    return success({ services: results });

  } catch (error) {
    console.error('[shipping/cost]', error);
    return serverError(error);
  }
}
