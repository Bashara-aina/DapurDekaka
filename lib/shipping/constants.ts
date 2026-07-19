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
    serviceFilter: /ice|frozen|same/i,
  },
  {
    tier: 'frozen_express',
    couriers: ['sicepat', 'jne', 'anteraja'],
    serviceFilter: /best|frozen|yes|reg/i,
  },
];

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
