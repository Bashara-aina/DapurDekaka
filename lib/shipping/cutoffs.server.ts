/**
 * Server-only seasonal cutoff adjustments (reads system_settings via DB).
 * Keep out of client bundles — see cutoffs.ts for sync client-safe helpers.
 */

import 'server-only';

import { getSetting } from '@/lib/settings/get-settings';
import type { ShippingTier } from './types';
import {
  CUTOFFS,
  cutoffHourForTier,
  wibHour,
  type CutoffStatus,
} from './cutoffs';

/**
 * Resolve cutoffs with rainy/Ramadan admin adjustment applied.
 */
export async function getAdjustedCutoffs(): Promise<typeof CUTOFFS> {
  const adjustment = await getSetting<string>('seasonal_cutoff_adjustment', 'string');
  const cutoffs = { ...CUTOFFS };
  if (adjustment === 'rainy') {
    cutoffs.express_payment = 15;
    cutoffs.express_booking = 15;
  } else if (adjustment === 'ramadan') {
    cutoffs.express_payment = 13;
    cutoffs.express_booking = 14;
    cutoffs.same_day = 11;
    cutoffs.intercity = 11;
  }
  return cutoffs;
}

/**
 * Live cutoff status for a tier with seasonal adjustment (WIB).
 */
export async function getAdjustedCutoffStatus(
  tier: ShippingTier,
  now: Date = new Date()
): Promise<CutoffStatus> {
  const cutoffs = await getAdjustedCutoffs();
  const cutoffHour = cutoffHourForTier(tier, cutoffs);
  const slot = new Date(now);
  slot.setHours(cutoffHour + 1, 0, 0, 0);
  if (wibHour(now) >= cutoffHour) {
    slot.setDate(slot.getDate() + 1);
  }
  return {
    beforeCutoff: wibHour(now) < cutoffHour,
    nextSlot: slot,
    cutoffHourWIB: cutoffHour,
  };
}
