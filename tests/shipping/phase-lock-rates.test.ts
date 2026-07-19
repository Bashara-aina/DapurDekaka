import { describe, it, expect, vi } from 'vitest';

// phase-gate imports @/lib/db at module load — stub it so no connection is needed.
vi.mock('@/lib/db', () => ({ db: {} }));

import { applyPhaseLockToRates } from '@/lib/shipping/phase-gate';
import { INTERCITY_MIN_SUBTOTAL_IDR } from '@/lib/constants/financial-rules';
import type { QuoteOption, ShippingRatesResult } from '@/lib/shipping/types';

function opt(id: string, tier: QuoteOption['tier']): QuoteOption {
  return {
    id,
    courierCode: 'sicepat',
    courierType: 'REG',
    displayName: 'SiCepat REG',
    tier,
    actualCost: 10000,
    customerCost: 12000,
    estimatedDuration: '1-2 hari',
    disabled: false,
    disabledReason: null,
    insuranceAvailable: true,
  };
}

function baseRates(): ShippingRatesResult {
  return {
    tiers: {
      express: { options: [opt('e1', 'express')], recommendedOptionId: 'e1' },
      frozenSameDay: { options: [opt('s1', 'frozen_same_day')], recommendedOptionId: 's1' },
      frozenExpress: { options: [opt('x1', 'frozen_express')], recommendedOptionId: 'x1' },
    },
    totalWeightGram: 1000,
    quoteFingerprint: 'abc123',
  };
}

describe('applyPhaseLockToRates — FD#2 frozen-tier locking at rates', () => {
  it('phase0: express stays open, both frozen tiers locked', () => {
    const r = applyPhaseLockToRates(baseRates(), 'phase0', 300_000);
    expect(r.tiers.express.options[0]!.disabled).toBe(false);
    expect(r.tiers.frozenSameDay.options[0]!.disabled).toBe(true);
    expect(r.tiers.frozenSameDay.options[0]!.disabledReason).toBe('phase_locked');
    expect(r.tiers.frozenExpress.options[0]!.disabled).toBe(true);
    expect(r.tiers.frozenExpress.options[0]!.disabledReason).toBe('phase_locked');
    expect(r.tiers.frozenSameDay.recommendedOptionId).toBeNull();
  });

  it('phase1: same-day open, express still phase-locked', () => {
    const r = applyPhaseLockToRates(baseRates(), 'phase1', 300_000);
    expect(r.tiers.frozenSameDay.options[0]!.disabled).toBe(false);
    expect(r.tiers.frozenExpress.options[0]!.disabled).toBe(true);
    expect(r.tiers.frozenExpress.options[0]!.disabledReason).toBe('phase_locked');
  });

  it('phase2 below intercity min: express locked with intercity_min_order', () => {
    const r = applyPhaseLockToRates(baseRates(), 'phase2', INTERCITY_MIN_SUBTOTAL_IDR - 1);
    expect(r.tiers.frozenExpress.options[0]!.disabled).toBe(true);
    expect(r.tiers.frozenExpress.options[0]!.disabledReason).toBe('intercity_min_order');
  });

  it('phase2 at/above intercity min: all tiers open', () => {
    const r = applyPhaseLockToRates(baseRates(), 'phase2', INTERCITY_MIN_SUBTOTAL_IDR);
    expect(r.tiers.frozenSameDay.options[0]!.disabled).toBe(false);
    expect(r.tiers.frozenExpress.options[0]!.disabled).toBe(false);
  });
});
