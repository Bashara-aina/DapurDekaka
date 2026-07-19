import { describe, it, expect } from 'vitest';
import { REFUND_DUE_DAYS } from '@/lib/constants/financial-rules';

describe('refund ledger — L2 Rule 7', () => {
  it('refunds must clear within 7 days', () => {
    expect(REFUND_DUE_DAYS).toBe(7);
  });

  it('computes refund due date 7 days after cancellation', () => {
    const cancelled = new Date('2026-07-01T10:00:00Z');
    const due = new Date(cancelled.getTime() + REFUND_DUE_DAYS * 24 * 60 * 60 * 1000);
    expect(due.toISOString()).toBe('2026-07-08T10:00:00.000Z');
  });
});