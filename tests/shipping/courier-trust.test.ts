import { describe, it, expect } from 'vitest';
import { isCourierAllowed, reliabilityScoreFor, COURIER_TRUST_TIER } from '@/lib/shipping/courier-trust';

describe('courier trust tiers — L3', () => {
  it('gojek is primary', () => {
    expect(COURIER_TRUST_TIER['gojek']).toBe('primary');
  });

  it('jne is probation', () => {
    expect(COURIER_TRUST_TIER['jne']).toBe('probation');
    expect(isCourierAllowed('jne')).toBe(true);
  });

  it('borzo is never (excluded)', () => {
    expect(COURIER_TRUST_TIER['borzo']).toBe('never');
    expect(isCourierAllowed('borzo')).toBe(false);
  });

  it('reliability score reflects trust tier', () => {
    expect(reliabilityScoreFor('gojek')).toBeGreaterThan(reliabilityScoreFor('jne'));
    expect(reliabilityScoreFor('random')).toBe(0.9);
    expect(reliabilityScoreFor('borzo')).toBe(0);
  });

  it('unknown courier defaults to allowed (let Biteship decide)', () => {
    expect(isCourierAllowed('totally_random_carrier')).toBe(true);
  });
});