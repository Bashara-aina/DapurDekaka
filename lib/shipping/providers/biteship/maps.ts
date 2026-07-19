import { biteshipFetch } from './client';

interface AreaSearchResponse {
  areas?: Array<{
    id: string;
    name: string;
    postal_code?: number;
  }>;
}

/**
 * Reverse geocode coordinates to Biteship area_id.
 */
export async function reverseGeocodeArea(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const data = await biteshipFetch<AreaSearchResponse>(
      `/maps/areas?countries=ID&input=${latitude},${longitude}&type=single`
    );
    return data.areas?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Search areas by address string for autocomplete proxy.
 */
export async function searchAreas(input: string): Promise<AreaSearchResponse['areas']> {
  const encoded = encodeURIComponent(input);
  const data = await biteshipFetch<AreaSearchResponse>(
    `/maps/areas?countries=ID&input=${encoded}&type=single`
  );
  return data.areas ?? [];
}
