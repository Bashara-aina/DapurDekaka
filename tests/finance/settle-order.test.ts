import { describe, it, expect, vi } from 'vitest';

// settle-order imports @/lib/db only for the transaction type; stub it out.
vi.mock('@/lib/db', () => ({ db: {} }));

import { settleOrderTx, InsufficientStockError, type SettleOrderInput } from '@/lib/finance/settle-order';
import {
  orders,
  productVariants,
  users,
  couponUsages,
  coupons,
  inventoryLogs,
  pointsHistory,
  orderStatusHistory,
} from '@/lib/db/schema';

interface FakeConfig {
  orderGuard: Array<{ id: string }>;
  variantRows: Array<Array<{ newStock: number }>>;
  userBalance: number;
}

interface Recorder {
  inventoryInserts: number;
  statusInserts: number;
  couponIncrements: number;
  pointsInserts: number;
}

function makeTx(config: FakeConfig, rec: Recorder) {
  let table: unknown = null;

  const builder = {
    set() {
      return builder;
    },
    where() {
      return builder;
    },
    from(t: unknown) {
      table = t;
      return builder;
    },
    orderBy() {
      return builder;
    },
    values() {
      if (table === inventoryLogs) rec.inventoryInserts++;
      if (table === orderStatusHistory) rec.statusInserts++;
      if (table === pointsHistory) rec.pointsInserts++;
      return builder;
    },
    onConflictDoNothing() {
      return builder;
    },
    async limit() {
      return [];
    },
    async returning() {
      if (table === orders) return config.orderGuard;
      if (table === productVariants) return config.variantRows.shift() ?? [];
      if (table === users) return [{ pointsBalance: config.userBalance }];
      return [];
    },
    // thenable: supports awaited chains without .returning() (coupon increment)
    then(resolve: (v: unknown) => void) {
      if (table === coupons) rec.couponIncrements++;
      resolve(undefined);
    },
  };

  return {
    update(t: unknown) {
      table = t;
      return builder;
    },
    insert(t: unknown) {
      table = t;
      return builder;
    },
    select() {
      return builder;
    },
  };
}

const baseOrder: SettleOrderInput = {
  id: 'order-1',
  orderNumber: 'DDK-20260720-0001',
  deliveryMethod: 'delivery',
  couponId: null,
  userId: null,
  subtotal: 120_000,
  discountAmount: 0,
  pointsDiscount: 0,
  shippingCost: 15_000,
  isB2b: false,
  items: [{ variantId: 'v1', quantity: 2 }],
};

describe('settleOrderTx — P0#3/#4 shared settlement', () => {
  it('returns false when the concurrency guard matches 0 rows (already processed)', async () => {
    const rec: Recorder = { inventoryInserts: 0, statusInserts: 0, couponIncrements: 0, pointsInserts: 0 };
    const tx = makeTx({ orderGuard: [], variantRows: [], userBalance: 0 }, rec);

    const settled = await settleOrderTx(tx as never, baseOrder, { source: 'webhook', note: 'x' });

    expect(settled).toBe(false);
    expect(rec.inventoryInserts).toBe(0);
    expect(rec.statusInserts).toBe(0);
  });

  it('deducts stock and writes history when the order is still pending', async () => {
    const rec: Recorder = { inventoryInserts: 0, statusInserts: 0, couponIncrements: 0, pointsInserts: 0 };
    const tx = makeTx({ orderGuard: [{ id: 'order-1' }], variantRows: [[{ newStock: 8 }]], userBalance: 0 }, rec);

    const settled = await settleOrderTx(tx as never, baseOrder, { source: 'webhook', note: 'paid' });

    expect(settled).toBe(true);
    expect(rec.inventoryInserts).toBe(1);
    expect(rec.statusInserts).toBe(1);
  });

  it('throws InsufficientStockError when a variant deduction matches 0 rows (oversell)', async () => {
    const rec: Recorder = { inventoryInserts: 0, statusInserts: 0, couponIncrements: 0, pointsInserts: 0 };
    const tx = makeTx({ orderGuard: [{ id: 'order-1' }], variantRows: [[]], userBalance: 0 }, rec);

    await expect(
      settleOrderTx(tx as never, baseOrder, { source: 'webhook', note: 'paid' })
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });

  it('awards recomputed net-of-discount points for logged-in users', async () => {
    const rec: Recorder = { inventoryInserts: 0, statusInserts: 0, couponIncrements: 0, pointsInserts: 0 };
    const tx = makeTx({ orderGuard: [{ id: 'order-1' }], variantRows: [[{ newStock: 8 }]], userBalance: 120 }, rec);

    const settled = await settleOrderTx(
      tx as never,
      { ...baseOrder, userId: 'user-1' },
      { source: 'webhook', note: 'paid' }
    );

    expect(settled).toBe(true);
    // 120_000 net → 120 points → one pointsHistory earn row.
    expect(rec.pointsInserts).toBe(1);
  });
});
