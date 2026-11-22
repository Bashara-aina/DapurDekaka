/**
 * Session 3: pack-ready E2E order → Biteship create (smoke-parity payload) → cancel.
 * Run: NODE_ENV=development npx tsx --env-file=.env scripts/session3-dispatch-retry.ts [orderNumber]
 */
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { orderStatusHistory, orders } from '../lib/db/schema';
import { cancelBiteshipOrder, createBiteshipOrder } from '../lib/shipping/providers/biteship/orders';
import { buildRateItems, fetchBiteshipRates } from '../lib/shipping/providers/biteship/rates';
import { WAREHOUSE_ORIGIN_LAT, WAREHOUSE_ORIGIN_LNG } from '../lib/shipping/constants';

async function main(): Promise<void> {
  const orderNumber = process.argv[2] ?? 'DDK-E2E-20261122-79';
  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, orderNumber),
    with: { items: true },
  });
  if (!order) throw new Error(`Order ${orderNumber} missing`);

  const dest = {
    lat: -6.9175,
    lng: 107.6191,
    address: 'Jl. Asia Afrika, Bandung Wetan, Kota Bandung',
    postalCode: '40111',
  };

  const items = buildRateItems([
    {
      name: 'Dimsum Crabstick (session3)',
      value: 65000,
      weightGram: 1000,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 10,
      quantity: 1,
    },
  ]);

  const rates = await fetchBiteshipRates({
    originLatitude: WAREHOUSE_ORIGIN_LAT,
    originLongitude: WAREHOUSE_ORIGIN_LNG,
    destinationLatitude: dest.lat,
    destinationLongitude: dest.lng,
    items,
    couriers: 'grab',
  });
  const grab =
    (rates ?? []).find((r) => r.courier_company === 'grab' && r.courier_type === 'instant') ??
    (rates ?? [])[0];
  if (!grab) throw new Error('No grab rate');
  console.log('rate', `${grab.courier_company}/${grab.courier_type}=${grab.price}`);

  const created = await createBiteshipOrder({
    referenceId: `session3-${order.orderNumber}-${Date.now()}`,
    courierCompany: grab.courier_company,
    courierType: grab.courier_type,
    originLatitude: WAREHOUSE_ORIGIN_LAT,
    originLongitude: WAREHOUSE_ORIGIN_LNG,
    originAddress: 'Jl. Sinom V No. 7, Turangga, Bandung',
    originContactName: 'Dapur Dekaka Warehouse',
    originContactPhone: '6289673737886',
    destinationLatitude: dest.lat,
    destinationLongitude: dest.lng,
    destinationAddress: dest.address,
    destinationContactName: order.recipientName,
    destinationContactPhone: '6281234567890',
    destinationPostalCode: dest.postalCode,
    items: items.map((i) => ({
      name: i.name,
      value: i.value,
      weight: i.weight,
      length: i.length,
      width: i.width,
      height: i.height,
      quantity: i.quantity,
    })),
  });

  console.log('booked', created);

  await db
    .update(orders)
    .set({
      status: 'shipped',
      shippedAt: new Date(),
      dispatchStatus: 'booked',
      dispatchBookedAt: new Date(),
      biteshipOrderId: created.biteshipOrderId,
      trackingNumber: created.waybillId,
      trackingUrl: created.trackingUrl,
      courierCode: grab.courier_company,
      courierService: grab.courier_type,
      biteshipActualCost: created.actualCost,
      dispatchLastError: null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  await db.insert(orderStatusHistory).values({
    orderId: order.id,
    fromStatus: 'packed',
    toStatus: 'shipped',
    changedByType: 'system',
    note: `Session3 smoke-parity book AWB ${created.waybillId ?? 'pending'}`,
  });

  if (created.biteshipOrderId) {
    const cancelled = await cancelBiteshipOrder(created.biteshipOrderId);
    console.log('cancelled', cancelled);
  }

  console.log('Session3 dispatch GREEN', order.orderNumber);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
