import { rajaOngkirGet } from './client';

export interface Province {
  province_id: string;
  province: string;
}

// In-memory cache — provinces never change
let cachedProvinces: Province[] | null = null;

export async function getProvinces(): Promise<Province[]> {
  if (cachedProvinces) return cachedProvinces;

  cachedProvinces = await rajaOngkirGet<Province[]>('/province');
  return cachedProvinces;
}

export function findProvinceById(
  provinces: Province[],
  id: string
): Province | undefined {
  return provinces.find((p) => p.province_id === id);
}
