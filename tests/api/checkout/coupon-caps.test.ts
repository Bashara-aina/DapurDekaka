import { describe, it, expect } from 'vitest';
import { enforceCouponCap, couponExceedsCap } from '@/lib/finance/points-calculator';
import { MAX_COUPON_VALUE_IDR, MAX_COUPON_PERCENT, MIN_ORDER_FOR_COUPON_IDR } from '@/lib/constants/financial-rules';

describe('coupon caps — L2 Rule 6', () => {
  it('caps coupons at min(15k, 10% of subtotal)', () => {
    expect(enforceCouponCap(250_000, 50_000)).toBe(15_000);
    expect(enforceCouponCap(500_000, 50_000)).toBe(15_000);
    expect(enforceCouponCap(500_000, 5_000)).toBe(5_000);
  });

  it('detects coupon exceeding cap', () => {
    expect(couponExceedsCap(250_000, 50_000)).toBe(true);
    expect(couponExceedsCap(250_000, 15_000)).toBe(false);
  });

  it('enforces minimum order for coupons', () => {
    expect(MIN_ORDER_FOR_COUPON_IDR).toBe(100_000);
    expect(enforceCouponCap(99_999, 10_000)).toBe(0);
  });

  it('reports MAX_COUPON_PERCENT = 10', () => {
    expect(MAX_COUPON_PERCENT).toBe(10);
  });

  it('MAX_COUPON_VALUE_IDR = 15_000', () => {
    expect(MAX_COUPON_VALUE_IDR).toBe(15_000);
  });
});