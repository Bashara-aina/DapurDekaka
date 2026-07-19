import { describe, it, expect } from 'vitest';
import { computeRefundReserve, computeReserveGap } from '@/lib/finance/reserve';

describe('refund reserve', () => {
  it('returns 5% of weekly gross', () => {
    expect(computeRefundReserve(2_000_000)).toBe(100_000);
    expect(computeRefundReserve(0)).toBe(0);
    expect(computeRefundReserve(250_000)).toBe(12_500);
  });

  it('respects custom target percent', () => {
    expect(computeRefundReserve(1_000_000, 8)).toBe(80_000);
    expect(computeRefundReserve(1_000_000, 0)).toBe(0);
  });

  it('computes reserve gap — returns positive number when short', () => {
    const shortfall = computeReserveGap(2_000_000, 50_000);
    expect(shortfall).toBe(50_000);
  });

  it('computes reserve gap — returns negative when over-funded', () => {
    const shortfall = computeReserveGap(1_000_000, 80_000);
    expect(shortfall).toBe(-30_000);
  });
});