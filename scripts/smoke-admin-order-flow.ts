/**
 * Admin E2E: seed paid order → pack → Biteship dispatch → assert → cancel Biteship.
 * Run: npm run smoke:admin-order
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { orderStatusHistory, orders } from '../lib/db/schema';
import { dispatchOrder } from '../lib/shipping/dispatch';
import { cancelBiteshipOrder } from '../lib/shipping/providers/biteship/orders';
import { seedAdminE2EOrder } from './seed-admin-e2e-order';

if (process.env.NODE_ENV === 'production') {
  console.error('ABORT: Cannot run admin order smoke in production.');
  process.exit(1);
}

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function add(name: string, pass: boolean, detail: string): void {
  checks.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}: ${detail}`);
}

/**
 * Mirror Field packing-queue PATCH: paid → processing → packed + dispatch pending.
 * Uses sequential updates (neon-http has no transactions).
 */
async function packOrderLikeField(orderId: string): Promise<void> {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) throw new Error('Order not found for packing');

  if (order.status === 'packed' && order.dispatchStatus === 'pending') {
    return;
  }
  if (order.status === 'shipped') {
    throw new Error('Order already shipped — use a fresh seed (--force)');
  }
  if (order.status !== 'paid' && order.status !== 'processing') {
    throw new Error(`Cannot pack from status=${order.status}`);
  }

  if (order.status === 'paid') {
    await db
      .update(orders)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'paid')));
    await db.insert(orderStatusHistory).values({
      orderId,
      fromStatus: 'paid',
      toStatus: 'processing',
      changedByType: 'system',
      note: 'E2E smoke: packing auto-progress',
    });
  }

  const [packed] = await db
    .update(orders)
    .set({
      status: 'packed',
      dispatchStatus: 'pending',
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, orderId), eq(orders.status, 'processing')))
    .returning({ id: orders.id });

  if (!packed) throw new Error('PACK_FAILED_STATUS_CHANGED');

  await db.insert(orderStatusHistory).values({
    orderId,
    fromStatus: 'processing',
    toStatus: 'packed',
    changedByType: 'system',
    note: 'E2E smoke: order packed',
  });
}

async function main(): Promise<void> {
  if (!process.env.BITESHIP_API_KEY) {
    console.error('ABORT: BITESHIP_API_KEY not set.');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('ABORT: DATABASE_URL not set.');
    process.exit(1);
  }

  console.log('Admin order E2E smoke starting…\n');

  let seeded;
  try {
    seeded = await seedAdminE2EOrder({ force: true });
    add(
      'Seed paid order',
      true,
      `${seeded.orderNumber} (${seeded.reused ? 'reused' : 'created'}) id=${seeded.id}`
    );
  } catch (err) {
    add('Seed paid order', false, err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  try {
    await packOrderLikeField(seeded.id);
    const after = await db.query.orders.findFirst({
      where: eq(orders.id, seeded.id),
      columns: { status: true, dispatchStatus: true },
    });
    add(
      'Pack (paid→packed)',
      after?.status === 'packed' && after.dispatchStatus === 'pending',
      `status=${after?.status} dispatchStatus=${after?.dispatchStatus}`
    );
  } catch (err) {
    add('Pack (paid→packed)', false, err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const outcome = await dispatchOrder(seeded.id, null);
  add(
    'Dispatch Biteship',
    outcome.ok,
    outcome.ok
      ? `biteshipOrderId=${outcome.biteshipOrderId} waybill=${outcome.waybillId ?? 'n/a'}`
      : `${outcome.status}: ${outcome.message ?? 'failed'}`
  );

  if (!outcome.ok) {
    process.exit(1);
  }

  const shipped = await db.query.orders.findFirst({
    where: eq(orders.id, seeded.id),
    columns: {
      status: true,
      biteshipOrderId: true,
      trackingNumber: true,
      dispatchStatus: true,
    },
  });

  add(
    'Neon shipped fields',
    shipped?.status === 'shipped' &&
      Boolean(shipped.biteshipOrderId) &&
      shipped.dispatchStatus === 'booked',
    `status=${shipped?.status} biteship=${shipped?.biteshipOrderId} tracking=${shipped?.trackingNumber ?? 'n/a'} dispatch=${shipped?.dispatchStatus}`
  );

  if (shipped?.biteshipOrderId) {
    try {
      const cancel = await cancelBiteshipOrder(
        shipped.biteshipOrderId,
        'others',
        'DapurDekaka admin E2E smoke cleanup'
      );
      add(
        'Cancel Biteship booking',
        cancel.success !== false,
        `status=${cancel.status ?? 'n/a'}`
      );
    } catch (err) {
      add('Cancel Biteship booking', false, err instanceof Error ? err.message : String(err));
    }

    await db
      .update(orders)
      .set({
        customerNote: 'E2E cleanup — Biteship booking cancelled; Neon left shipped for admin visibility',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, seeded.id));
  }

  const hard = checks.filter((c) => !c.pass).length;
  console.log(`\nHard failures: ${hard}`);
  console.log(`Open /admin/orders and /admin/field — order ${seeded.orderNumber} should appear.\n`);
  process.exit(hard > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unhandled:', err);
  process.exit(1);
});
