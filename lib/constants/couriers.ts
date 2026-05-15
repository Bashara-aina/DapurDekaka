/**
 * Only cold-chain couriers allowed for frozen products
 */
export const ALLOWED_COURIERS = [
  { code: 'sicepat', service: 'FROZEN', displayName: 'SiCepat FROZEN' },
  { code: 'jne', service: 'YES', displayName: 'JNE YES (Next Day)' },
  { code: 'anteraja', service: 'FROZEN', displayName: 'AnterAja Frozen' },
] as const;

export type AllowedCourier = typeof ALLOWED_COURIERS[number];

/**
 * Tracking URL templates by courier code.
 * Use {{trackingNumber}} placeholder that gets replaced at runtime.
 */
export const COURIER_TRACKING_URLS: Record<string, string> = {
  sicepat: 'https://www.sicepat.com/check/waybill/{{trackingNumber}}',
  jne: 'https://www.jne.co.id/tracking/trace/{{trackingNumber}}',
  anteraja: 'https://anteraja.id/trace/{{trackingNumber}}',
};

/**
 * Generate tracking URL for a given courier code and tracking number.
 */
export function getTrackingUrl(courierCode: string, trackingNumber: string): string {
  const template = COURIER_TRACKING_URLS[courierCode.toLowerCase()];
  if (!template || !trackingNumber) return '';
  return template.replace('{{trackingNumber}}', trackingNumber);
}

/**
 * Alias for backward compatibility
 */
export { getTrackingUrl as buildTrackingUrl };

/**
 * Bandung city ID for RajaOngkir origin
 */
export const ORIGIN_CITY_ID = '23';

/**
 * Minimum billable weight in grams
 */
export const MIN_WEIGHT_GRAM = 1000;
