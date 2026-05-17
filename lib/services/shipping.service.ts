export const COLD_CHAIN_COURIERS = [
  { code: 'sicepat', service: 'FROZEN', name: 'SiCepat FROZEN' },
  { code: 'jne', service: 'YES', name: 'JNE YES' },
  { code: 'anteraja', service: 'FROZEN', name: 'AnterAja FROZEN' },
] as const;

const RAJAONGKIR_BASE = 'https://api.rajaongkir.com/starter';

async function rajaOngkirFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${RAJAONGKIR_BASE}${path}`, {
    ...options,
    headers: {
      key: process.env.RAJAONGKIR_API_KEY!,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`RajaOngkir error: ${res.status}`);
  }

  const data = await res.json();
  return data.rajaongkir;
}

export async function getProvinces() {
  const result = await rajaOngkirFetch('/province');
  return result.results as Array<{ province_id: string; province: string }>;
}

export async function getCitiesByProvince(provinceId: string) {
  const result = await rajaOngkirFetch(`/city?province=${provinceId}`);
  return result.results as Array<{
    city_id: string;
    city_name: string;
    type: string;
    postal_code: string;
  }>;
}

export async function calculateShippingCost(input: {
  originCityId: string;
  destinationCityId: string;
  weightGram: number;
}) {
  const { originCityId, destinationCityId, weightGram } = input;

  const weight = Math.max(weightGram, 1000);

  const results: Array<{
    courier: string;
    service: string;
    name: string;
    costIDR: number;
    estimatedDays: string;
  }> = [];

  for (const courier of COLD_CHAIN_COURIERS) {
    try {
      const data = await rajaOngkirFetch('/cost', {
        method: 'POST',
        body: JSON.stringify({
          origin: originCityId,
          destination: destinationCityId,
          weight,
          courier: courier.code,
        }),
      });

      const couriersData = data.results as any[];
      for (const c of couriersData) {
        const service = c.costs.find(
          (s: any) => s.service === courier.service
        );
        if (service) {
          results.push({
            courier: courier.code,
            service: courier.service,
            name: courier.name,
            costIDR: service.cost[0].value,
            estimatedDays: service.cost[0].etd,
          });
        }
      }
    } catch (e) {
      console.warn(`Shipping fetch failed for ${courier.code}:`, e);
    }
  }

  return results;
}
