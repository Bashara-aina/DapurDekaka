import { rajaOngkirPost } from './client';
import { withRetry } from '@/lib/utils/integration-helpers';
import { ALLOWED_COURIERS, MIN_WEIGHT_GRAM, RAJAONGKIR_ORIGIN_CITY_ID } from '@/lib/constants/couriers';
import { getSetting } from '@/lib/settings/get-settings';

export interface ShippingCostResult {
  courier: string;
  service: string;
  displayName: string;
  cost: number;
  estimatedDays: string;
}

export interface ShippingCostResponse {
  available: true;
  services: ShippingCostResult[];
}

export interface ShippingUnavailableResponse {
  available: false;
  message: string;
  whatsappUrl: string;
}

interface RajaOngkirCostItem {
  service: string;
  cost: Array<{ value: number; etd: string; note: string }>;
}

interface RajaOngkirCostResult {
  code: string;
  name: string;
  costs: RajaOngkirCostItem[];
}

/**
 * Calculate shipping cost for a destination city and weight.
 *
 * Note: RajaOngkir Starter tier only supports origin_id 501 (Jakarta).
 * The system_settings `rajaongkir_origin_city_id` MUST be set to '501' for Starter accounts.
 * If not set, we default to 501 (Jakarta) — NOT 23 (Bandung) which would cause API errors.
 */
export async function calculateShippingCost(
  destinationCityId: string,
  weightGram: number
): Promise<ShippingCostResponse | ShippingUnavailableResponse> {
  const billableWeight = Math.max(weightGram, MIN_WEIGHT_GRAM);
  const roundedWeight = Math.ceil(billableWeight / 100) * 100;

  const [originCityId, whatsappNumber] = await Promise.all([
    getSetting('rajaongkir_origin_city_id'),
    getSetting('store_whatsapp_number'),
  ]);

  // RajaOngkir Starter only supports origin 501 (Jakarta).
  // If the setting is 23 (Bandung) for a Starter account, the API will error.
  // Default to 501 to ensure the API call succeeds.
  const origin = originCityId ?? RAJAONGKIR_ORIGIN_CITY_ID;
  const waNumber = whatsappNumber ?? process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '6281234567890';

  const allResults: ShippingCostResult[] = [];

  for (const courier of ALLOWED_COURIERS) {
    try {
      const results = await withRetry(
        () =>
          rajaOngkirPost<RajaOngkirCostResult[]>('/cost', {
            origin,
            destination: destinationCityId,
            weight: roundedWeight,
            courier: courier.code,
          }),
        { maxRetries: 2, retryableStatuses: [429, 503], context: 'RajaOngkir.calculateCost' }
      );

      for (const result of results) {
        for (const service of result.costs) {
          if (service.service === courier.service) {
            const cost = service.cost[0];
            if (!cost) continue;
            allResults.push({
              courier: courier.code,
              service: courier.service,
              displayName: courier.displayName,
              cost: cost.value,
              estimatedDays: cost.etd || '2-4',
            });
          }
        }
      }
    } catch {
      // If a courier fails, skip it and try others
      continue;
    }
  }

  if (allResults.length === 0) {
    return {
      available: false,
      message:
        'Mohon maaf, layanan pengiriman frozen ke daerah Anda belum tersedia. Silakan hubungi kami via WhatsApp untuk solusi pengiriman khusus.',
      whatsappUrl: `https://wa.me/${waNumber.replace(/^0/, '62')}`,
    };
  }

  // Sort by cost ascending
  allResults.sort((a, b) => a.cost - b.cost);

  return {
    available: true,
    services: allResults,
  };
}
