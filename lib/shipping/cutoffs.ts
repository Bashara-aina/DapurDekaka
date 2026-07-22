/**
 * Cut-off schedule (L3 + L4) — when each courier tier must be paid/booked
 * to dispatch the same day (Asia/Jakarta).
 *
 * Hard rule from L3: failure to book before cut-off means the order ships
 * next morning. Rainy season / Ramadan: an admin setting narrows the window
 * further; this module exposes the underlying policy that the ops card reads.
 */

import type { ShippingTier } from './types';
import { getSetting } from '@/lib/settings/get-settings';

export const BANDUNG_TZ = 'Asia/Jakarta';

export const CUTOFFS: Record<'express_payment' | 'express_booking' | 'same_day' | 'intercity', number> = {
  express_payment: 14, // Payment must succeed before 14:00 WIB for same-day Kilat.
  express_booking: 16, // Warehouse must book the courier before 16:00 WIB.
  same_day: 12,
  intercity: 12,
};

export interface CutoffStatus {
  readonly beforeCutoff: boolean;
  readonly nextSlot: Date;
  readonly cutoffHourWIB: number;
}

function wibHour(date: Date): number {
  const wibString = date.toLocaleString('en-US', { timeZone: BANDUNG_TZ });
  const date2 = new Date(wibString);
  return date2.getHours();
}

function nextBookingSlot(now: Date, cutoffHour: number): Date {
  const slot = new Date(now);
  slot.setHours(cutoffHour + 1, 0, 0, 0);
  // If we're already past cutoff today, the next slot is tomorrow at the same hour.
  if (wibHour(now) >= cutoffHour) {
    slot.setDate(slot.getDate() + 1);
  }
  return slot;
}

/**
 * Resolve the live cutoff status for a tier, in WIB.
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

export async function getAdjustedCutoffStatus(tier: ShippingTier, now: Date = new Date()): Promise<CutoffStatus> {
  const cutoffs = await getAdjustedCutoffs();
  const cutoffHour =
    tier === 'express'
      ? cutoffs.express_booking
      : tier === 'frozen_same_day'
        ? cutoffs.same_day
        : tier === 'frozen_express'
          ? cutoffs.intercity
          : 23;
  return {
    beforeCutoff: wibHour(now) < cutoffHour,
    nextSlot: nextBookingSlot(now, cutoffHour),
    cutoffHourWIB: cutoffHour,
  };
}

export function getCutoffStatus(tier: ShippingTier, now: Date = new Date()): CutoffStatus {
  const cutoffHour =
    tier === 'express'
      ? CUTOFFS.express_booking
      : tier === 'frozen_same_day'
        ? CUTOFFS.same_day
        : tier === 'frozen_express'
          ? CUTOFFS.intercity
          : 23;
  return {
    beforeCutoff: wibHour(now) < cutoffHour,
    nextSlot: nextBookingSlot(now, cutoffHour),
    cutoffHourWIB: cutoffHour,
  };
}
