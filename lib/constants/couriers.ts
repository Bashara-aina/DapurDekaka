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
 * Bandung city ID for RajaOngkir origin
 */
export const ORIGIN_CITY_ID = '23';

/**
 * Minimum billable weight in grams
 */
export const MIN_WEIGHT_GRAM = 1000;
