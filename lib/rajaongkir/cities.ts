import { unstable_cache } from 'next/cache';
import { rajaOngkirGet } from './client';

export interface City {
  city_id: string;
  province_id: string;
  province: string;
  type: 'city' | 'subdistrict';
  city_name: string;
  postal_code: string;
}

export const getCitiesByProvince = unstable_cache(
  async (provinceId: string): Promise<City[]> => {
    const cities = await rajaOngkirGet<City[]>(`/city?province=${provinceId}`);
    return cities;
  },
  ['rajaongkir-cities'],
  { revalidate: 86400 } // 24 hours
);

export function findCityById(
  cities: City[],
  id: string
): City | undefined {
  return cities.find((c) => c.city_id === id);
}
