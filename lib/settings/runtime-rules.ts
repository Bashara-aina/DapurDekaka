/**
 * Runtime business rules from system_settings with constant fallbacks.
 */

import { getSetting } from '@/lib/settings/get-settings';
import { SETTING_KEYS } from '@/lib/settings/canonical-keys';
import {
  POINTS_EARN_RATE,
  POINTS_EXPIRY_DAYS,
  POINTS_MIN_REDEEM,
  POINTS_MAX_REDEEM_PCT,
  B2B_POINTS_MULTIPLIER,
} from '@/lib/constants/points';
import { MAX_PAYMENT_RETRIES } from '@/lib/constants';

export interface PointsRuntimeRules {
  earnRate: number;
  expiryDays: number;
  minRedeem: number;
  maxRedeemPct: number;
  b2bMultiplier: number;
}

export async function getPointsRuntimeRules(): Promise<PointsRuntimeRules> {
  const [earnRate, expiryDays, minRedeem, maxRedeemPct, b2bMultiplier] = await Promise.all([
    getSetting<number>(SETTING_KEYS.POINTS_EARN_RATE, 'integer'),
    getSetting<number>(SETTING_KEYS.POINTS_EXPIRY_DAYS, 'integer'),
    getSetting<number>(SETTING_KEYS.POINTS_MIN_REDEEM, 'integer'),
    getSetting<number>(SETTING_KEYS.POINTS_MAX_REDEEM_PCT, 'integer'),
    getSetting<number>(SETTING_KEYS.B2B_POINTS_MULTIPLIER, 'integer'),
  ]);

  return {
    earnRate: earnRate ?? POINTS_EARN_RATE,
    expiryDays: expiryDays ?? POINTS_EXPIRY_DAYS,
    minRedeem: minRedeem ?? POINTS_MIN_REDEEM,
    maxRedeemPct: maxRedeemPct ?? POINTS_MAX_REDEEM_PCT,
    b2bMultiplier: b2bMultiplier ?? B2B_POINTS_MULTIPLIER,
  };
}

export async function getPaymentMaxRetries(): Promise<number> {
  const value = await getSetting<number>(SETTING_KEYS.PAYMENT_MAX_RETRIES, 'integer');
  return value ?? MAX_PAYMENT_RETRIES;
}

export async function getStoreContactSettings(): Promise<{
  whatsapp: string;
  address: string;
  instagramUrl: string;
  openingHours: string;
}> {
  const [whatsapp, address, instagramUrl, openingHours] = await Promise.all([
    getSetting<string>(SETTING_KEYS.STORE_WHATSAPP_NUMBER),
    getSetting<string>(SETTING_KEYS.STORE_ADDRESS),
    getSetting<string>(SETTING_KEYS.INSTAGRAM_URL),
    getSetting<string>(SETTING_KEYS.STORE_OPENING_HOURS),
  ]);

  return {
    whatsapp: whatsapp ?? '',
    address: address ?? '',
    instagramUrl: instagramUrl ?? '',
    openingHours: openingHours ?? '',
  };
}
