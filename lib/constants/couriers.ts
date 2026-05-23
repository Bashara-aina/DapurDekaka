/**
 * Only cold-chain couriers allowed for frozen products.
 * These are the ONLY couriers we show — no JNE REG, J&T, Pos Indonesia, etc.
 */
export const ALLOWED_COURIERS = [
  { code: 'sicepat', service: 'FROZEN', displayName: 'SiCepat FROZEN' },
  { code: 'jne', service: 'YES', displayName: 'JNE YES (Next Day)' },
  { code: 'anteraja', service: 'FROZEN', displayName: 'AnterAja Frozen' },
] as const;

export type AllowedCourier = typeof ALLOWED_COURIERS[number];

/**
 * RajaOngkir origin city ID for shipping cost calculations.
 * Defaults to Bandung (23) from env var RAJAONGKIR_ORIGIN_CITY_ID.
 * If using RajaOngkir Starter tier with Jakarta-registered account, set to '501'.
 * For accurate Bandung-origin shipping rates, use RajaOngkir Pro with origin "23".
 */
export const RAJAONGKIR_ORIGIN_CITY_ID =
  (process.env.RAJAONGKIR_ORIGIN_CITY_ID ?? '23') as string;

/**
 * @deprecated Use RAJAONGKIR_ORIGIN_CITY_ID instead. RajaOngkir Starter only supports
 * origin 501 (Jakarta) but this project uses Bandung (23) for accurate frozen shipping rates.
 */
export const ORIGIN_CITY_ID = RAJAONGKIR_ORIGIN_CITY_ID;

/**
 * Minimum billable weight in grams
 */
export const MIN_WEIGHT_GRAM = 1000;

/**
 * Tracking URL templates by courier code.
 * @deprecated Use getTrackingUrl from lib/utils/tracking-url.ts instead
 */
export const COURIER_TRACKING_URLS: Record<string, string> = {
  sicepat: 'https://www.sicepat.com/check/waybill/{{trackingNumber}}',
  jne: 'https://www.jne.co.id/tracking/trace/{{trackingNumber}}',
  anteraja: 'https://anteraja.id/trace/{{trackingNumber}}',
};

/**
 * Generate tracking URL for a given courier code and tracking number.
 * @deprecated Use getTrackingUrl from lib/utils/tracking-url.ts instead
 */
export function buildTrackingUrl(courierCode: string, trackingNumber: string): string {
  const template = COURIER_TRACKING_URLS[courierCode?.toLowerCase()];
  if (!template || !trackingNumber) return '';
  return template.replace('{{trackingNumber}}', trackingNumber);
}
