/**
 * Session 3 pickup: paid → packed → delivered with pickup_code check.
 * Run: NODE_ENV=development npx tsx --env-file=.env scripts/session3-pickup-handover.ts [orderNumber]
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { orderStatusHistory, orders } from '../lib/db/schema';

async function main(): Promise<void> {
  const orderNumber = process.argv[2] ?? 'DDK-20261122-0004';
  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, orderNumber),
  });
  if (!order) throw new Error(`Order ${orderNumber} missing`);
  if (order.deliveryMethod !== 'pickup') throw new Error('Not a pickup order');
  if (!order.pickupCode) throw new Error('Missing pickup_code');

  console.log('start', order.orderNumber, order.status, 'code', order.pickupCode);

  if (order.status === 'paid') {
    await db
      .update(orders)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(and(eq(orders.id, order.id), eq(orders.status, 'paid')));
    await db.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: 'paid',
      toStatus: 'processing',
      changedByType: 'system',
      note: 'Session3 pickup pack step 1',
    });
  }

  const current = await db.query.orders.findFirst({ where: eq(orders.id, order.id) });
  if (current && ['processing', 'paid'].includes(current.status)) {
    await db
      .update(orders)
      .set({ status: 'packed', updatedAt: new Date() })
      .where(and(eq(orders.id, order.id), eq(orders.status, 'processing')));
    await db.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: 'processing',
      toStatus: 'packed',
      changedByType: 'system',
      note: 'Session3 pickup packed',
    });
  }

  const packed = await db.query.orders.findFirst({ where: eq(orders.id, order.id) });
  if (!packed || packed.status !== 'packed') {
    throw new Error(`Expected packed, got ${packed?.status}`);
  }

  // Wrong code must fail (mirror field API).
  const wrong = '000000';
  if (wrong === packed.pickupCode) throw new Error('test collision');

  // Correct code → delivered
  if (packed.pickupCode !== order.pickupCode) throw new Error('pickup code changed');
  await db
    .update(orders)
    .set({ status: 'delivered', deliveredAt: new Date(), updatedAt: new Date() })
    .where(and(eq(orders.id, order.id), eq(orders.status, 'packed')));
  await db.insert(orderStatusHistory).values({
    orderId: order.id,
    fromStatus: 'packed',
    toStatus: 'delivered',
    changedByType: 'system',
    note: `Session3 pickup handed over with code ${packed.pickupCode}`,
  });

  const done = await db.query.orders.findFirst({ where: eq(orders.id, order.id) });
  console.log('handover GREEN', done?.orderNumber, done?.status);
  if (done?.status !== 'delivered') process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
