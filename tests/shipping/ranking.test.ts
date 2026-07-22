import { describe, it, expect } from 'vitest';
import { rankOptions, pickRecommendedOptionId } from '@/lib/shipping/ranking';
import type { QuoteOption } from '@/lib/shipping/types';

function makeOption(overrides: Partial<QuoteOption> & Pick<QuoteOption, 'id' | 'customerCost'>): QuoteOption {
  return {
    courierCode: 'sicepat',
    courierType: 'BEST',
    displayName: 'SiCepat BEST',
    tier: 'frozen_express',
    actualCost: overrides.customerCost,
    estimatedDuration: '2 hari',
    disabled: false,
    disabledReason: null,
    insuranceAvailable: true,
    cashOnDeliveryAvailable: false,
    ...overrides,
  };
}

describe('shipping ranking', () => {
  it('sorts disabled options below eligible ones', () => {
    const options = [
      makeOption({ id: 'a', customerCost: 10000, disabled: true, disabledReason: 'paxel_weight_exceeded' }),
      makeOption({ id: 'b', customerCost: 15000, disabled: false }),
      makeOption({ id: 'c', customerCost: 12000, disabled: false }),
    ];
    const ranked = rankOptions(options);
    expect(ranked[0]?.id).toBe('c');
    expect(ranked[ranked.length - 1]?.disabled).toBe(true);
  });

  it('picks cheapest eligible option as recommended', () => {
    const options = [
      makeOption({ id: 'cheap', customerCost: 11000 }),
      makeOption({ id: 'expensive', customerCost: 20000 }),
    ];
    expect(pickRecommendedOptionId(options)).toBe('cheap');
  });

  it('returns null when all options disabled', () => {
    const options = [
      makeOption({ id: 'x', customerCost: 10000, disabled: true, disabledReason: 'test' }),
    ];
    expect(pickRecommendedOptionId(options)).toBeNull();
  });
});
