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
 * RajaOngkir Starter tier origin city ID.
 * NOTE: RajaOngkir Starter only supports origin_id: 501 (Jakarta).
 * If you need Bandung-origin shipping rates, you must upgrade to RajaOngkir Pro.
 * The `rajaongkir_origin_city_id` setting should be configured accordingly.
 */
export const RAJAONGKIR_STARTER_ORIGIN_ID = '501' as const;

/**
 * @deprecated Use RAJAONGKIR_STARTER_ORIGIN_ID. RajaOngkir Starter only supports
 * origin 501 (Jakarta). The `rajaongkir_origin_city_id` setting should store 501.
 */
export const ORIGIN_CITY_ID = '23';

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
