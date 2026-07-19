/**
 * Loyalty points calculator (L2 Rule 3).
 *
 * Points are earned ONLY on the net product payment: subtotal − coupon −
 * points redeemed (excluding shipping). This is the constitutional change
 * implemented before first order (per L2 Decision 2 — R2 if deferred past
 * launch).
 *
 * Centralized here so the webhook, initiate, and Net-30 paths all agree.
 */

import {
  MAX_COUPON_VALUE_IDR,
  MAX_COUPON_PERCENT,
  MIN_ORDER_FOR_COUPON_IDR,
} from '@/lib/constants/financial-rules';
import { POINTS_EARN_RATE } from '@/lib/constants/points';

export interface PointsInputs {
  readonly subtotal: number;
  readonly couponDiscount: number;
  readonly pointsDiscount: number;
  readonly shippingCost: number;
  readonly isB2b: boolean;
}

/**
 * Calculate loyalty points earned for an order, basis: net product payment.
 * Returns integer points (floor-rounded per L2 Rule 3).
 */
export function calculatePointsEarned(input: PointsInputs): number {
  const net = Math.max(0, input.subtotal - input.couponDiscount - input.pointsDiscount);
  const basePoints = Math.floor(net / 1000) * POINTS_EARN_RATE;
  return Math.max(0, basePoints);
}

/**
 * Cap a coupon discount against the L2 Rule 6 ceiling.
 * Returns the capped discount value in integer IDR.
 */
export function enforceCouponCap(subtotal: number, requestedDiscount: number): number {
  if (subtotal < MIN_ORDER_FOR_COUPON_IDR) return 0;
  const percentCap = Math.floor((subtotal * MAX_COUPON_PERCENT) / 100);
  return Math.max(0, Math.min(requestedDiscount, MAX_COUPON_VALUE_IDR, percentCap));
}

/**
 * Verify a coupon value would not exceed the L2 cap. Used by validate-coupon
 * and initiate endpoints to refuse coupons that would over-discount.
 */
export function couponExceedsCap(subtotal: number, discountValue: number): boolean {
  if (subtotal < MIN_ORDER_FOR_COUPON_IDR) return true;
  const cap = Math.min(
    MAX_COUPON_VALUE_IDR,
    Math.floor((subtotal * MAX_COUPON_PERCENT) / 100)
  );
  return discountValue > cap;
}
