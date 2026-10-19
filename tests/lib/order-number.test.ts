import { describe, it, expect } from 'vitest';
import {
  getMidtransOrderId,
  stripRetrySuffix,
  generatePickupCode,
} from '@/lib/utils/generate-order-number';

describe('order number helpers', () => {
  it('adds and strips the -retry-N suffix', () => {
    expect(getMidtransOrderId('DDK-20261019-0007', 0)).toBe('DDK-20261019-0007');
    expect(getMidtransOrderId('DDK-20261019-0007', 3)).toBe('DDK-20261019-0007-retry-3');
    expect(stripRetrySuffix('DDK-20261019-0007-retry-3')).toBe('DDK-20261019-0007');
    expect(stripRetrySuffix('DDK-20261019-0007')).toBe('DDK-20261019-0007');
  });

  it('pickup codes are 6 digits and not the order number', () => {
    const code = generatePickupCode();
    expect(code).toMatch(/^\d{6}$/);
  });
});
