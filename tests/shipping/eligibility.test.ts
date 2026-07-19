import { describe, it, expect } from 'vitest';
import { checkEligibility, excludeBorzo } from '@/lib/shipping/eligibility';
import { PAXEL_MAX_WEIGHT_GRAM, INSTANT_BIKE_MAX_WEIGHT_GRAM } from '@/lib/shipping/constants';

describe('shipping eligibility', () => {
  it('excludes borzo from courier lists', () => {
    expect(excludeBorzo(['gojek', 'borzo', 'grab'])).toEqual(['gojek', 'grab']);
  });

  it('disables paxel when weight exceeds 5kg', () => {
    const result = checkEligibility({
      courierCode: 'paxel',
      tier: 'frozen_same_day',
      totalWeightGram: PAXEL_MAX_WEIGHT_GRAM + 500,
    });
    expect(result.disabled).toBe(true);
    expect(result.disabledReason).toBe('paxel_weight_exceeded');
  });

  it('allows paxel at exactly 5kg', () => {
    const result = checkEligibility({
      courierCode: 'paxel',
      tier: 'frozen_same_day',
      totalWeightGram: PAXEL_MAX_WEIGHT_GRAM,
    });
    expect(result.disabled).toBe(false);
  });

  it('blocks express tier over bike weight cap', () => {
    const result = checkEligibility({
      courierCode: 'gojek',
      tier: 'express',
      totalWeightGram: INSTANT_BIKE_MAX_WEIGHT_GRAM + 1,
    });
    expect(result.eligible).toBe(false);
    expect(result.disabledReason).toBe('instant_weight_exceeded');
  });
});
