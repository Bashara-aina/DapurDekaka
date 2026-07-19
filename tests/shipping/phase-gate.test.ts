import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the DB module so phase-gate doesn't need a live connection.
const queryState = {
  orderCount: 0,
  spoilageCount: 0,
  dispatchFailedCount: 0,
  shippingPhase: 'phase0' as 'phase0' | 'phase1' | 'phase2',
};

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockImplementation(() => {
          // We don't inspect the where clause — we look at the order of
          // .select().from().where() calls and return the matching value.
          // The simplest path: return whatever queryState exposes, based on the
          // most recent select call context, captured via the call counter.
          const pickValue = (): { value: number } => {
            // We expose counts via a simple counter set per-test via
            // `queryState` and decide which counter to return by inspecting
            // the call stack via the call sequence set up in beforeEach.
            const idx = sequence.idx++;
            if (idx === 0) return { value: queryState.orderCount };
            if (idx === 1) return { value: queryState.spoilageCount };
            return { value: queryState.dispatchFailedCount };
          };
          return Promise.resolve([pickValue()]);
        }),
      })),
    })),
  },
}));

vi.mock('@/lib/settings/get-settings', () => ({
  getSetting: vi.fn().mockImplementation(async (_key: string) => queryState.shippingPhase),
}));

// Track the sequence of select() calls so the mock above can return counts in
// the right order. We re-create this object for each test.
const sequence = { idx: 0 };
vi.mock('@/lib/shipping/geo-policy', async () => {
  const actual = await vi.importActual<typeof import('@/lib/shipping/geo-policy')>(
    '@/lib/shipping/geo-policy'
  );
  return actual;
});

import { enforceShippingPhaseGates } from '@/lib/shipping/phase-gate';
import { INTERCITY_MIN_SUBTOTAL_IDR } from '@/lib/constants/financial-rules';

describe('enforceShippingPhaseGates — L3 phase-criteria enforcement', () => {
  beforeEach(() => {
    sequence.idx = 0;
    queryState.orderCount = 0;
    queryState.spoilageCount = 0;
    queryState.dispatchFailedCount = 0;
    queryState.shippingPhase = 'phase0';
  });

  it('always allows pickup regardless of phase', async () => {
    const result = await enforceShippingPhaseGates('pickup', 0);
    expect(result.ok).toBe(true);
    expect(result.httpStatus).toBe(200);
  });

  it('always allows express regardless of phase', async () => {
    const result = await enforceShippingPhaseGates('express', 0);
    expect(result.ok).toBe(true);
    expect(result.httpStatus).toBe(200);
  });

  it('rejects frozen_same_day when effective phase is phase0 (criteria not met)', async () => {
    queryState.shippingPhase = 'phase1';
    queryState.orderCount = 10; // < 50 threshold

    const result = await enforceShippingPhaseGates('frozen_same_day', 100_000);
    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(503);
    expect(result.code).toBe('phase_not_ready');
    expect(result.message).toMatch(/Same-Day/);
    expect(result.effectivePhase).toBe('phase0');
  });

  it('allows frozen_same_day when criteria are met (effective phase1)', async () => {
    queryState.shippingPhase = 'phase1';
    queryState.orderCount = 60;
    queryState.spoilageCount = 0;
    queryState.dispatchFailedCount = 1;

    const result = await enforceShippingPhaseGates('frozen_same_day', 100_000);
    expect(result.ok).toBe(true);
    expect(result.effectivePhase).toBe('phase1');
  });

  it('rejects frozen_express when effective phase is below phase2', async () => {
    queryState.shippingPhase = 'phase1';
    queryState.orderCount = 80;
    queryState.spoilageCount = 0;
    queryState.dispatchFailedCount = 0;

    const result = await enforceShippingPhaseGates('frozen_express', INTERCITY_MIN_SUBTOTAL_IDR);
    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(503);
    expect(result.code).toBe('phase_not_ready');
    expect(result.effectivePhase).toBe('phase1');
  });

  it('rejects frozen_express with intercity_min_order when subtotal < 250k (phase2 unlocked)', async () => {
    queryState.shippingPhase = 'phase2';
    queryState.orderCount = 120;
    queryState.spoilageCount = 0;
    queryState.dispatchFailedCount = 0;

    const result = await enforceShippingPhaseGates('frozen_express', INTERCITY_MIN_SUBTOTAL_IDR - 1);
    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(422);
    expect(result.code).toBe('intercity_min_order');
    expect(result.effectivePhase).toBe('phase2');
  });

  it('allows frozen_express at exactly the intercity minimum', async () => {
    queryState.shippingPhase = 'phase2';
    queryState.orderCount = 120;
    queryState.spoilageCount = 0;
    queryState.dispatchFailedCount = 0;

    const result = await enforceShippingPhaseGates('frozen_express', INTERCITY_MIN_SUBTOTAL_IDR);
    expect(result.ok).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.effectivePhase).toBe('phase2');
  });

  it('forces phase back to phase0 when phase1 configured but spoilage too high', async () => {
    queryState.shippingPhase = 'phase2';
    queryState.orderCount = 100;
    queryState.spoilageCount = 5; // 5% — fails the <2% criterion
    queryState.dispatchFailedCount = 0;

    const result = await enforceShippingPhaseGates('frozen_same_day', 100_000);
    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(503);
    expect(result.effectivePhase).toBe('phase0');
  });

  it('forces phase back to phase0 when dispatch failure rate too high', async () => {
    queryState.shippingPhase = 'phase2';
    queryState.orderCount = 100;
    queryState.spoilageCount = 0;
    queryState.dispatchFailedCount = 6; // 6% — fails the <5% criterion

    const result = await enforceShippingPhaseGates('frozen_same_day', 100_000);
    expect(result.ok).toBe(false);
    expect(result.effectivePhase).toBe('phase0');
  });
});
