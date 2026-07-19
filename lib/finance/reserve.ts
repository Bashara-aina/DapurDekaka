/**
 * Refund reserve math (L2 Rule 8).
 *
 * Reserve is computed from the most recent 7-day settled gross. It is a target
 * to hold in the operating account, not a separate ledger — actual cash flow
 * comes from the Biteship wallet top-up + Midtrans settlement cycle.
 */

import { DEFAULT_REFUND_RESERVE_PERCENT } from '@/lib/constants/financial-rules';

/**
 * Compute the refund-reserve target for a single week.
 * @param weeklyGrossIdr Sum of paid order totalAmount over the last 7 days.
 * @param percentOverride Optional override for the reserve percentage.
 */
export function computeRefundReserve(
  weeklyGrossIdr: number,
  percentOverride: number = DEFAULT_REFUND_RESERVE_PERCENT
): number {
  if (weeklyGrossIdr <= 0) return 0;
  const reserve = Math.floor((weeklyGrossIdr * percentOverride) / 100);
  return Math.max(0, reserve);
}

/**
 * Compute the refund-reserve gap (positive = shortfall, negative = over-funded).
 */
export function computeReserveGap(
  weeklyGrossIdr: number,
  heldCashIdr: number,
  percentOverride: number = DEFAULT_REFUND_RESERVE_PERCENT
): number {
  const target = computeRefundReserve(weeklyGrossIdr, percentOverride);
  return target - heldCashIdr;
}
