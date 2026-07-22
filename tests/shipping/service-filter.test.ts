import { describe, expect, it } from 'vitest';
import {
  TIER_COURIER_CONFIG,
  matchesTierServiceFilter,
} from '@/lib/shipping/constants';

function filterFor(tier: string): RegExp | undefined {
  return TIER_COURIER_CONFIG.find((c) => c.tier === tier)?.serviceFilter;
}

describe('tier serviceFilter (L3 cold-chain)', () => {
  it('frozen_same_day accepts paxel medium/large and ice/frozen/same', () => {
    const f = filterFor('frozen_same_day');
    expect(matchesTierServiceFilter('medium', f)).toBe(true);
    expect(matchesTierServiceFilter('large', f)).toBe(true);
    expect(matchesTierServiceFilter('ice', f)).toBe(true);
    expect(matchesTierServiceFilter('frozen', f)).toBe(true);
    expect(matchesTierServiceFilter('same_day', f)).toBe(true);
  });

  it('frozen_same_day rejects economy reg and cargo', () => {
    const f = filterFor('frozen_same_day');
    expect(matchesTierServiceFilter('reg', f)).toBe(false);
    expect(matchesTierServiceFilter('jtr', f)).toBe(false);
    expect(matchesTierServiceFilter('oke', f)).toBe(false);
  });

  it('frozen_express accepts best/yes/frozen and rejects reg/jtr', () => {
    const f = filterFor('frozen_express');
    expect(matchesTierServiceFilter('best', f)).toBe(true);
    expect(matchesTierServiceFilter('yes', f)).toBe(true);
    expect(matchesTierServiceFilter('frozen', f)).toBe(true);
    expect(matchesTierServiceFilter('reg', f)).toBe(false);
    expect(matchesTierServiceFilter('jtr', f)).toBe(false);
    expect(matchesTierServiceFilter('medium', f)).toBe(false);
  });

  it('express has no service filter (all gojek/grab types pass)', () => {
    const f = filterFor('express');
    expect(f).toBeUndefined();
    expect(matchesTierServiceFilter('instant', f)).toBe(true);
    expect(matchesTierServiceFilter('same_day', f)).toBe(true);
  });
});
