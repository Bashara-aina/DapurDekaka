/**
 * Seed a paid delivery order into Neon so /admin/orders and /admin/field show data.
 * Run: npm run seed:admin-e2e
 * Options: --force  create a new order even if today's E2E order exists
 */
import { and, eq, gt, like } from 'drizzle-orm';
import { db } from '../lib/db';
import {
  orderItems,
  orderStatusHistory,
  orders,
  productVariants,
} from '../lib/db/schema';
import { formatDateForOrder } from '../lib/utils/format-date';
import { WAREHOUSE_ORIGIN_LAT, WAREHOUSE_ORIGIN_LNG } from '../lib/shipping/constants';

if (process.env.NODE_ENV === 'production') {
  console.error('ABORT: Cannot run admin E2E seed in production.');
  process.exit(1);
}

const FORCE = process.argv.includes('--force');
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export interface SeededE2EOrder {
  id: string;
  orderNumber: string;
  reused: boolean;
}

function todayOrderNumber(suffix?: string): string {
  const date = formatDateForOrder(new Date());
  if (suffix) return `DDK-E2E-${date}-${suffix}`.slice(0, 20);
  return `DDK-E2E-${date}`.slice(0, 20);
}

export interface SeedAdminE2EOptions {
  force?: boolean;
}

/**
 * Create or reuse today's paid delivery E2E order for admin Field/dispatch testing.
 */
export async function seedAdminE2EOrder(
  options: SeedAdminE2EOptions = {}
): Promise<SeededE2EOrder> {
  const force = options.force ?? FORCE;
  const prefix = `DDK-E2E-${formatDateForOrder(new Date())}`;

  if (!force) {
    const existing = await db.query.orders.findFirst({
      where: like(orders.orderNumber, `${prefix}%`),
      columns: { id: true, orderNumber: true, status: true },
    });
    if (existing && ['paid', 'processing', 'packed'].includes(existing.status)) {
      return { id: existing.id, orderNumber: existing.orderNumber, reused: true };
    }
  }

  const variant = await db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.isActive, true),
      gt(productVariants.stock, 0)
    ),
    with: { product: true },
  });

  if (!variant?.product || variant.product.deletedAt) {
    throw new Error(
      'No active variant with stock ≥ 1. Seed products and restock, then re-run.'
    );
  }

  const qty = 1;
  const subtotal = variant.price * qty;
  const shippingActual = 16000;
  const shippingMarkup = Math.round(shippingActual * 0.2);
  const shippingCost = shippingActual + shippingMarkup;
  const totalAmount = subtotal + shippingCost;
  const orderNumber = force
    ? todayOrderNumber(String(Date.now()).slice(-2))
    : todayOrderNumber();

  const [order] = await db
    .insert(orders)
    .values({
      orderNumber,
      status: 'paid',
      deliveryMethod: 'delivery',
      recipientName: 'E2E Admin Test',
      recipientEmail: 'e2e-admin@dapurdekaka.com',
      recipientPhone: '6281234567890',
      addressLine: 'Jl. Asia Afrika No. 1, Bandung Wetan',
      district: 'Bandung Wetan',
      city: 'Bandung',
      province: 'Jawa Barat',
      postalCode: '40111',
      courierCode: 'grab',
      courierService: 'instant',
      courierName: 'GrabExpress Instant',
      shippingCost,
      estimatedDays: '1 - 3 Hours',
      subtotal,
      discountAmount: 0,
      pointsDiscount: 0,
      totalAmount,
      shippingTier: 'express',
      latitude: String(-6.9175),
      longitude: String(107.6191),
      originLatitude: String(WAREHOUSE_ORIGIN_LAT),
      originLongitude: String(WAREHOUSE_ORIGIN_LNG),
      biteshipActualCost: shippingActual,
      shippingMarkupAmount: shippingMarkup,
      insuranceType: 'none',
      insuranceFee: 0,
      dispatchStatus: 'not_required',
      courierInstantAck: true,
      customerNote: 'Admin E2E seed order — safe to pack/dispatch',
      paymentMethod: 'e2e_seed',
      paidAt: new Date(),
      midtransOrderId: `E2E-${orderNumber}`,
    })
    .returning({ id: orders.id, orderNumber: orders.orderNumber });

  if (!order) throw new Error('Failed to insert E2E order');

  await db.insert(orderItems).values({
    orderId: order.id,
    variantId: variant.id,
    productId: variant.productId,
    productNameId: variant.product.nameId,
    productNameEn: variant.product.nameEn,
    variantNameId: variant.nameId,
    variantNameEn: variant.nameEn,
    sku: variant.sku,
    unitPrice: variant.price,
    quantity: qty,
    subtotal,
    weightGram: variant.weightGram,
  });

  await db.insert(orderStatusHistory).values({
    orderId: order.id,
    fromStatus: null,
    toStatus: 'paid',
    changedByType: 'system',
    note: 'E2E seed: simulated Midtrans settlement',
  });

  return { id: order.id, orderNumber: order.orderNumber, reused: false };
}

async function main(): Promise<void> {
  console.log('Seeding admin E2E paid delivery order…');
  const result = await seedAdminE2EOrder();
  console.log(result.reused ? 'Reused existing E2E order:' : 'Created E2E order:');
  console.log(`  id:          ${result.id}`);
  console.log(`  orderNumber: ${result.orderNumber}`);
  console.log(`  /admin/orders → ${APP_URL}/admin/orders`);
  console.log(`  /admin/field  → ${APP_URL}/admin/field`);
}

const isDirectRun =
  typeof process.argv[1] === 'string' && process.argv[1].includes('seed-admin-e2e-order');

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
