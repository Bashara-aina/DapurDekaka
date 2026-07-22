import type { ShippingTier } from './types';

export const BORZO_EXCLUDED = 'borzo';

export const SHIPPING_MARKUP_PERCENT = Number(process.env.SHIPPING_MARKUP_PERCENT ?? '20');

export const PAXEL_MAX_WEIGHT_GRAM = 5000;

export const INSTANT_BIKE_MAX_WEIGHT_GRAM = 15000;

export const MIN_WEIGHT_GRAM = 1000;

export const WAREHOUSE_ORIGIN_LAT = Number(process.env.WAREHOUSE_ORIGIN_LAT ?? '-6.958');

export const WAREHOUSE_ORIGIN_LNG = Number(process.env.WAREHOUSE_ORIGIN_LNG ?? '107.636');

export interface TierCourierConfig {
  tier: ShippingTier;
  couriers: string[];
  serviceFilter?: RegExp;
}

export const TIER_COURIER_CONFIG: TierCourierConfig[] = [
  {
    tier: 'express',
    couriers: ['gojek', 'grab'],
  },
  {
    tier: 'frozen_same_day',
    couriers: ['paxel', 'anteraja'],
    // Live Paxel uses medium/large package codes; also match ice/frozen/same when dashboard enables them.
    // Never match plain "reg" (economy) — L3: no REG on cold-chain tiers.
    serviceFilter: /ice|frozen|same|medium|large/i,
  },
  {
    tier: 'frozen_express',
    couriers: ['sicepat', 'jne', 'anteraja'],
    // L3: never REG/economy/cargo (jtr). Allow next-day/best/yes/frozen only.
    serviceFilter: /best|frozen|yes/i,
  },
];

/**
 * Whether a Biteship courier_type/service code passes a tier's service filter.
 */
export function matchesTierServiceFilter(
  courierType: string,
  serviceFilter?: RegExp
): boolean {
  if (!serviceFilter) return true;
  return serviceFilter.test(courierType);
}

export const INSURANCE_RATES: Record<'basic' | 'premium', number> = {
  basic: 0.002,
  premium: 0.005,
};

export const COURIER_DISPLAY_NAMES: Record<string, string> = {
  gojek: 'GoSend',
  grab: 'GrabExpress',
  paxel: 'Paxel',
  anteraja: 'AnterAja',
  sicepat: 'SiCepat',
  jne: 'JNE',
};
