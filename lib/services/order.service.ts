import { db } from '@/lib/db';
import { orders, orderItems, orderStatusHistory, orderSequences } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { format } from 'date-fns';

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['packed'],
  packed: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
};

export function isValidStatusTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function addStatusHistory(
  orderId: string,
  toStatus: string,
  note?: string | null,
  changedBy?: string | null
) {
  const [order] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  await db.insert(orderStatusHistory).values({
    orderId,
    fromStatus: order?.status ?? null,
    toStatus: toStatus as any,
    changedByUserId: changedBy ?? null,
    changedByType: changedBy ? 'admin' : 'system',
    note: note ?? null,
  });
}

export async function generateOrderNumber(): Promise<string> {
  const dateKey = format(new Date(), 'yyyyMMdd');

  const [row] = await db
    .insert(orderSequences)
    .values({ dateKey, lastSeq: 1 })
    .onConflictDoUpdate({
      target: orderSequences.dateKey,
      set: {
        lastSeq: sql`${orderSequences.lastSeq} + 1`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ lastSeq: orderSequences.lastSeq });

  if (!row) {
    throw new Error('Failed to generate order number');
  }

  const seq = String(row.lastSeq).padStart(4, '0');
  return `DDK-${dateKey}-${seq}`;
}
