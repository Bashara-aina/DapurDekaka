import { describe, it, expect } from 'vitest';
import { calculatePointsEarned } from '@/lib/finance/points-calculator';

describe('points earning — net product payment only', () => {
  it('earns points on full subtotal', () => {
    expect(calculatePointsEarned({ subtotal: 250_000, couponDiscount: 0, pointsDiscount: 0, shippingCost: 0, isB2b: false })).toBe(250);
  });

  it('does not award points on coupon-discounted amount', () => {
    const points = calculatePointsEarned({
      subtotal: 250_000,
      couponDiscount: 50_000,
      pointsDiscount: 0,
      shippingCost: 0,
      isB2b: false,
    });
    expect(points).toBe(200);
  });

  it('does not award points on points-discounted amount', () => {
    const points = calculatePointsEarned({
      subtotal: 250_000,
      couponDiscount: 0,
      pointsDiscount: 25_000,
      shippingCost: 0,
      isB2b: false,
    });
    expect(points).toBe(225);
  });

  it('does not stack — net payment is the only base', () => {
    const points = calculatePointsEarned({
      subtotal: 500_000,
      couponDiscount: 100_000,
      pointsDiscount: 50_000,
      shippingCost: 0,
      isB2b: false,
    });
    expect(points).toBe(350);
  });

  it('floors to nearest 1000 (no fractional points)', () => {
    expect(calculatePointsEarned({ subtotal: 199_999, couponDiscount: 0, pointsDiscount: 0, shippingCost: 0, isB2b: false })).toBe(199);
  });

  it('returns zero when net is zero or negative', () => {
    expect(calculatePointsEarned({ subtotal: 100_000, couponDiscount: 100_000, pointsDiscount: 0, shippingCost: 0, isB2b: false })).toBe(0);
  });
});