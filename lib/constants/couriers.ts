import { getTrackingUrl } from '@/lib/utils/tracking-url';

/**
 * Biteship courier configuration for Shipping V2 three-tier model.
 * RajaOngkir removed — all rates via Biteship API.
 */

export const BORZO_EXCLUDED = 'borzo';

export const TIER_EXPRESS_COURIERS = ['gojek', 'grab'] as const;

export const TIER_FROZEN_SAME_DAY_COURIERS = ['paxel', 'anteraja'] as const;

export const TIER_FROZEN_EXPRESS_COURIERS = ['sicepat', 'jne', 'anteraja'] as const;

export const ALLOWED_COURIER_CODES = [
  ...TIER_EXPRESS_COURIERS,
  ...TIER_FROZEN_SAME_DAY_COURIERS,
  ...TIER_FROZEN_EXPRESS_COURIERS,
] as const;

export const ALLOWED_COURIERS = ALLOWED_COURIER_CODES.map((code) => ({
  code,
  service: 'FROZEN',
  displayName: code.toUpperCase(),
}));

export const PAXEL_MAX_WEIGHT_KG = 5;

export const INSTANT_MAX_WEIGHT_KG = 15;

export const MIN_WEIGHT_GRAM = 1000;

export const SHIPPING_TIER_LABELS: Record<string, { id: string; en: string }> = {
  express: { id: 'Express (GoSend/Grab)', en: 'Express (GoSend/Grab)' },
  frozen_same_day: { id: 'Frozen Same-day', en: 'Frozen Same-day' },
  frozen_express: { id: 'Frozen Express', en: 'Frozen Express' },
  pickup: { id: 'Ambil di Toko', en: 'Store Pickup' },
};

export const TRACKING_FORMATS: Record<string, RegExp> = {
  gojek: /^[A-Z0-9-]{6,30}$/i,
  grab: /^[A-Z0-9-]{6,30}$/i,
  paxel: /^[A-Z0-9]{8,20}$/i,
  sicepat: /^[A-Z0-9]{10,20}$/i,
  jne: /^[A-Z0-9]{10,15}$/i,
  anteraja: /^[A-Z0-9]{12}$/i,
};

/**
 * Validate tracking number format for a given courier.
 */
export function validateTrackingFormat(
  courierCode: string,
  trackingNumber: string
): string | null {
  if (!trackingNumber) return null;
  const format = TRACKING_FORMATS[courierCode?.toLowerCase()];
  if (!format) return null;
  if (!format.test(trackingNumber)) {
    return `Format nomor resi tidak valid untuk ${courierCode.toUpperCase()}`;
  }
  return null;
}

/** @deprecated Use getTrackingUrl from lib/utils/tracking-url.ts */
export function buildTrackingUrl(courierCode: string, trackingNumber: string): string {
  return getTrackingUrl(courierCode, trackingNumber) ?? '';
}
