import { describe, it, expect } from 'vitest';
import { getCustomerDispatchLabel } from '@/lib/shipping/status-labels';

describe('getCustomerDispatchLabel', () => {
  it('never shows shipped for failed dispatch', () => {
    const label = getCustomerDispatchLabel('shipped', 'failed', 'delivery');
    expect(label.id).toContain('dijadwalkan ulang');
    expect(label.id).not.toContain('dikirim');
  });

  it('shows pickup ready for paid pickup', () => {
    const label = getCustomerDispatchLabel('paid', 'not_required', 'pickup');
    expect(label.id).toContain('Siap diambil');
  });
});
