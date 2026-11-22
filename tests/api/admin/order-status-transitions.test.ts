import { describe, it, expect } from 'vitest';
import { ORDER_TRANSITIONS } from '@/lib/constants/orders';

/**
 * Guards the admin status-transition map so warehouse/admin paths cannot
 * invent illegal jumps (e.g. pending_payment → delivered).
 * Note: pending_payment → paid happens only via Midtrans settlement, not admin.
 */
describe('ORDER_TRANSITIONS', () => {
  it('allows pending_payment → cancelled for both methods', () => {
    expect(ORDER_TRANSITIONS.delivery.pending_payment).toContain('cancelled');
    expect(ORDER_TRANSITIONS.pickup.pending_payment).toContain('cancelled');
  });

  it('allows paid → processing / cancelled / refunded', () => {
    expect(ORDER_TRANSITIONS.delivery.paid).toEqual(
      expect.arrayContaining(['processing', 'cancelled', 'refunded'])
    );
  });

  it('delivery packed → shipped; pickup packed → delivered', () => {
    expect(ORDER_TRANSITIONS.delivery.packed).toContain('shipped');
    expect(ORDER_TRANSITIONS.pickup.packed).toContain('delivered');
  });

  it('delivery shipped → delivered', () => {
    expect(ORDER_TRANSITIONS.delivery.shipped).toContain('delivered');
  });

  it('has no transitions out of delivered', () => {
    expect(ORDER_TRANSITIONS.delivery.delivered).toEqual([]);
    expect(ORDER_TRANSITIONS.pickup.delivered).toEqual([]);
  });
});
