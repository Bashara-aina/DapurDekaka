import { describe, expect, it } from 'vitest';
import { normalizePricingRow } from '@/lib/shipping/providers/biteship/rates';

describe('normalizePricingRow', () => {
  it('maps live Biteship company/type fields', () => {
    const row = normalizePricingRow({
      company: 'gojek',
      courier_code: 'gojek',
      type: 'instant',
      courier_service_code: 'instant',
      courier_name: 'Gojek',
      price: 22000,
      duration: '1 - 2 Hours',
      available_for_insurance: true,
    });

    expect(row.courier_company).toBe('gojek');
    expect(row.courier_type).toBe('instant');
    expect(row.courier_name).toBe('Gojek');
    expect(row.price).toBe(22000);
  });

  it('prefers legacy courier_company/courier_type when present', () => {
    const row = normalizePricingRow({
      courier_company: 'grab',
      courier_type: 'same_day',
      company: 'ignored',
      type: 'ignored',
      price: 16000,
    });

    expect(row.courier_company).toBe('grab');
    expect(row.courier_type).toBe('same_day');
  });
});
