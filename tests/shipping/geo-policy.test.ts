import { describe, it, expect } from 'vitest';
import { classifyDestination, isServiceable, gatePhase1, tierVisibilityForPhase } from '@/lib/shipping/geo-policy';

describe('shipping geo policy — L3 hard blocks', () => {
  it('classifies Bandung centroid as bandung', () => {
    expect(classifyDestination(-6.917, 107.619)).toBe('bandung');
  });

  it('classifies Jakarta centroid as jabodetabek', () => {
    expect(classifyDestination(-6.2088, 106.8456)).toBe('jabodetabek');
  });

  it('classifies Semarang as jawa48h', () => {
    expect(classifyDestination(-6.9667, 110.4167)).toBe('jawa48h');
  });

  it('classifies Bali as beyond', () => {
    expect(classifyDestination(-8.65, 115.2167)).toBe('beyond');
  });

  it('serviceability: Bandung allows pickup at phase0', () => {
    const r = isServiceable(-6.917, 107.619, 'pickup', 3000, 'phase0');
    expect(r.ok).toBe(true);
  });

  it('serviceability: beyond region blocks frozen_same_day', () => {
    const r = isServiceable(-8.65, 115.2167, 'frozen_same_day', 2000, 'phase1');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/beyond|polygon/i);
  });

  it('phase 1 gate fails when order count < 50', () => {
    const result = gatePhase1({
      phase0OrderCount: 30,
      spoilageRatePercent: 0,
      dispatchFailureRatePercent: 0,
    });
    expect(result).toBe(false);
  });

  it('phase 1 gate succeeds with full criteria', () => {
    const result = gatePhase1({
      phase0OrderCount: 60,
      spoilageRatePercent: 1,
      dispatchFailureRatePercent: 3,
    });
    expect(result).toBe(true);
  });

  it('phase 0 only allows pickup + express', () => {
    const visible = tierVisibilityForPhase('phase0');
    expect(visible.has('pickup')).toBe(true);
    expect(visible.has('express')).toBe(true);
    expect(visible.has('frozen_same_day')).toBe(false);
  });
});