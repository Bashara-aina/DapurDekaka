import { eq, and, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  orders,
  productVariants,
  inventoryLogs,
  coupons,
  couponUsages,
  users,
  pointsHistory,
  orderStatusHistory,
} from '@/lib/db/schema';
import { POINTS_EXPIRY_DAYS } from '@/lib/constants/points';
import { calculatePointsEarned } from '@/lib/finance/points-calculator';

/**
 * Shared order-settlement routine (P3 Decision 1 + backlog #3/#4).
 *
 * The constitutional stock model is settlement-only deduction: stock is
 * deducted here (webhook OR reconcile cron), never at initiate (except the
 * Net-30 B2B exception, which handles its own deduction inline).
 *
 * This single function is the ONE place that flips an order to `paid`, so both
 * the Midtrans webhook and the reconcile cron stay byte-for-byte consistent on
 * stock deduction, coupon counting, and net-of-discount points math.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface SettleOrderItem {
  readonly variantId: string;
  readonly quantity: number;
}

export interface SettleOrderInput {
  readonly id: string;
  readonly orderNumber: string;
  readonly deliveryMethod: string;
  readonly couponId: string | null;
  readonly userId: string | null;
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly pointsDiscount: number;
  readonly shippingCost: number;
  readonly isB2b: boolean;
  readonly items: readonly SettleOrderItem[];
}

export interface SettleOptions {
  readonly source: 'webhook' | 'reconcile';
  readonly note: string;
  readonly paymentType?: string | null;
  readonly vaNumber?: string | null;
  readonly transactionId?: string | null;
}

export class InsufficientStockError extends Error {
  constructor(public readonly variantId: string) {
    super(`Settlement failed: insufficient stock for variant ${variantId}`);
    this.name = 'InsufficientStockError';
  }
}

/**
 * Settle an order inside an existing transaction.
 * @returns `true` if this call flipped the order to paid; `false` if another
 *          process already settled it (0 rows on the guarded update).
 */
export async function settleOrderTx(
  tx: Tx,
  order: SettleOrderInput,
  opts: SettleOptions
): Promise<boolean> {
  // Concurrency guard (P0#4): only settle a still-pending order. 0 rows means a
  // parallel webhook/reconcile already handled it.
  const [updated] = await tx
    .update(orders)
    .set({
      status: 'paid',
      paidAt: new Date(),
      ...(opts.paymentType !== undefined && { midtransPaymentType: opts.paymentType }),
      ...(opts.vaNumber !== undefined && { midtransVaNumber: opts.vaNumber }),
      ...(opts.transactionId !== undefined && { midtransTransactionId: opts.transactionId }),
      ...(order.deliveryMethod === 'pickup'
        ? { pickupCode: order.orderNumber, dispatchStatus: 'not_required' as const }
        : { dispatchStatus: 'pending' as const }),
    })
    .where(and(eq(orders.id, order.id), eq(orders.status, 'pending_payment')))
    .returning({ id: orders.id });

  if (!updated) return false;

  await deductStock(tx, order);
  await recordCouponUsage(tx, order);
  await awardPoints(tx, order);

  await tx.insert(orderStatusHistory).values({
    orderId: order.id,
    fromStatus: 'pending_payment',
    toStatus: 'paid',
    changedByType: 'system',
    note: opts.note,
    metadata: {
      source: opts.source,
      paymentType: opts.paymentType ?? null,
      transactionId: opts.transactionId ?? null,
    },
  });

  return true;
}

async function deductStock(tx: Tx, order: SettleOrderInput): Promise<void> {
  for (const item of order.items) {
    if (item.quantity <= 0) continue;
    const [row] = await tx
      .update(productVariants)
      .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)` })
      .where(and(eq(productVariants.id, item.variantId), gte(productVariants.stock, item.quantity)))
      .returning({ newStock: productVariants.stock });

    if (!row || row.newStock === undefined) {
      throw new InsufficientStockError(item.variantId);
    }

    await tx.insert(inventoryLogs).values({
      variantId: item.variantId,
      changeType: 'sale',
      quantityBefore: row.newStock + item.quantity,
      quantityAfter: row.newStock,
      quantityDelta: -item.quantity,
      orderId: order.id,
    });
  }
}

async function recordCouponUsage(tx: Tx, order: SettleOrderInput): Promise<void> {
  if (!order.couponId) return;

  const existing = await tx
    .select({ id: couponUsages.id })
    .from(couponUsages)
    .where(and(eq(couponUsages.couponId, order.couponId), eq(couponUsages.orderId, order.id)))
    .limit(1);

  if (existing.length === 0) {
    await tx
      .update(coupons)
      .set({ usedCount: sql`used_count + 1` })
      .where(eq(coupons.id, order.couponId));
  }

  await tx
    .insert(couponUsages)
    .values({
      couponId: order.couponId,
      orderId: order.id,
      userId: order.userId ?? null,
      discountApplied: order.discountAmount,
    })
    .onConflictDoNothing();
}

async function awardPoints(tx: Tx, order: SettleOrderInput): Promise<void> {
  if (!order.userId) return;

  // L2 Rule 3: recompute net-of-discount base — never trust the stale
  // `pointsEarned` column (0 for non-Net-30 orders at initiate).
  const earnedPoints = calculatePointsEarned({
    subtotal: order.subtotal,
    couponDiscount: order.discountAmount,
    pointsDiscount: order.pointsDiscount,
    shippingCost: order.shippingCost,
    isB2b: order.isB2b,
  });

  if (earnedPoints <= 0) return;

  const [updatedUser] = await tx
    .update(users)
    .set({ pointsBalance: sql`points_balance + ${earnedPoints}` })
    .where(eq(users.id, order.userId))
    .returning({ pointsBalance: users.pointsBalance });

  await tx.insert(pointsHistory).values({
    userId: order.userId,
    type: 'earn',
    pointsAmount: earnedPoints,
    pointsBalanceAfter: updatedUser?.pointsBalance ?? earnedPoints,
    descriptionId: `Pembelian ${order.orderNumber}`,
    descriptionEn: `Purchase ${order.orderNumber}`,
    orderId: order.id,
    expiresAt: new Date(Date.now() + POINTS_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
  });
}
