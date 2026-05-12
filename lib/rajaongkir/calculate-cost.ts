import { rajaOngkirPost } from './client';
import { ALLOWED_COURIERS, ORIGIN_CITY_ID, MIN_WEIGHT_GRAM } from '@/lib/constants/couriers';

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

export async function calculateShippingCost(
  destinationCityId: string,
  weightGram: number
): Promise<ShippingCostResponse | ShippingUnavailableResponse> {
  const billableWeight = Math.max(weightGram, MIN_WEIGHT_GRAM);
  const roundedWeight = Math.ceil(billableWeight / 100) * 100;

  const allResults: ShippingCostResult[] = [];

  for (const courier of ALLOWED_COURIERS) {
    try {
      const results = await rajaOngkirPost<RajaOngkirCostResult[]>(
        '/cost',
        {
          origin: ORIGIN_CITY_ID,
          destination: destinationCityId,
          weight: roundedWeight,
          courier: courier.code,
        }
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
    const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '6281234567890';
    return {
      available: false,
      message:
        'Mohon maaf, layanan pengiriman frozen ke daerah Anda belum tersedia. Silakan hubungi kami via WhatsApp untuk solusi pengiriman khusus.',
      whatsappUrl: `https://wa.me/${whatsappNumber.replace(/^0/, '62')}`,
    };
  }

  // Sort by cost ascending
  allResults.sort((a, b) => a.cost - b.cost);

  return {
    available: true,
    services: allResults,
  };
}
