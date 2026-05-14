import { ALLOWED_COURIERS, ORIGIN_CITY_ID } from '@/lib/constants/couriers';

const RAJAONGKIR_BASE_URL = 'https://api.rajaongkir.com/starter';

export interface RajaOngkirResponse<T> {
  rajaongkir: {
    status: { code: number; description: string };
    results: T;
  };
}

export async function rajaOngkirGet<T>(endpoint: string): Promise<T> {
  const apiKey = process.env.RAJAONGKIR_API_KEY;
  if (!apiKey) {
    throw new Error('RAJAONGKIR_API_KEY is not set');
  }

  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    res = await fetch(`${RAJAONGKIR_BASE_URL}${endpoint}`, {
      headers: {
        key: apiKey,
      },
      next: { revalidate: 3600 },
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('RajaOngkir API timeout after 10s');
    }
    throw new Error(`RajaOngkir network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    throw new Error(`RajaOngkir API error: ${res.status}`);
  }

  const data: RajaOngkirResponse<T> = await res.json();

  if (data.rajaongkir.status.code !== 200) {
    throw new Error(`RajaOngkir error: ${data.rajaongkir.status.description}`);
  }

  return data.rajaongkir.results;
}

export async function rajaOngkirPost<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const apiKey = process.env.RAJAONGKIR_API_KEY;
  if (!apiKey) {
    throw new Error('RAJAONGKIR_API_KEY is not set');
  }

  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    res = await fetch(`${RAJAONGKIR_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        key: apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(
        Object.entries(body).map(([k, v]) => [k, String(v)])
      ).toString(),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('RajaOngkir API timeout after 10s');
    }
    throw new Error(`RajaOngkir network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    throw new Error(`RajaOngkir API error: ${res.status}`);
  }

  const data: RajaOngkirResponse<T> = await res.json();

  if (data.rajaongkir.status.code !== 200) {
    throw new Error(`RajaOngkir error: ${data.rajaongkir.status.description}`);
  }

  return data.rajaongkir.results;
}

export { ALLOWED_COURIERS };
