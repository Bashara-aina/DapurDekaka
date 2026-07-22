/**
 * Cut-off schedule (L3 + L4) — when each courier tier must be paid/booked
 * to dispatch the same day (Asia/Jakarta).
 *
 * Client-safe: no DB / settings imports. Seasonal adjustments live in
 * cutoffs.server.ts (server-only).
 */

import type { ShippingTier } from './types';

export const BANDUNG_TZ = 'Asia/Jakarta';

export const CUTOFFS: Record<'express_payment' | 'express_booking' | 'same_day' | 'intercity', number> = {
  express_payment: 14,
  express_booking: 16,
  same_day: 12,
  intercity: 12,
};

export interface CutoffStatus {
  readonly beforeCutoff: boolean;
  readonly nextSlot: Date;
  readonly cutoffHourWIB: number;
}

export function wibHour(date: Date): number {
  const wibString = date.toLocaleString('en-US', { timeZone: BANDUNG_TZ });
  return new Date(wibString).getHours();
}

function nextBookingSlot(now: Date, cutoffHour: number): Date {
  const slot = new Date(now);
  slot.setHours(cutoffHour + 1, 0, 0, 0);
  if (wibHour(now) >= cutoffHour) {
    slot.setDate(slot.getDate() + 1);
  }
  return slot;
}

export function cutoffHourForTier(
  tier: ShippingTier,
  cutoffs: typeof CUTOFFS = CUTOFFS
): number {
  if (tier === 'express') return cutoffs.express_booking;
  if (tier === 'frozen_same_day') return cutoffs.same_day;
  if (tier === 'frozen_express') return cutoffs.intercity;
  return 23;
}

/**
 * Resolve the live cutoff status for a tier, in WIB (static schedule).
 */
export function getCutoffStatus(tier: ShippingTier, now: Date = new Date()): CutoffStatus {
  const cutoffHour = cutoffHourForTier(tier);
  return {
    beforeCutoff: wibHour(now) < cutoffHour,
    nextSlot: nextBookingSlot(now, cutoffHour),
    cutoffHourWIB: cutoffHour,
  };
}
