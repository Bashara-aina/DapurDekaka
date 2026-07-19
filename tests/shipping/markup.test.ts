import { describe, it, expect } from 'vitest';
import { applyMarkup, getMarkupAmount, verifyCustomerShippingCost } from '@/lib/shipping/markup';

describe('shipping markup', () => {
  it('applies 20% markup rounded up to integer IDR', () => {
    expect(applyMarkup(10000)).toBe(12000);
    expect(applyMarkup(12500)).toBe(15000);
  });

  it('returns zero for zero or negative cost', () => {
    expect(applyMarkup(0)).toBe(0);
  });

  it('calculates markup amount correctly', () => {
    expect(getMarkupAmount(10000, 12000)).toBe(2000);
  });

  it('verifies customer shipping cost matches server markup', () => {
    expect(verifyCustomerShippingCost(50000, 60000)).toBe(true);
    expect(verifyCustomerShippingCost(50000, 55000)).toBe(false);
  });
});
