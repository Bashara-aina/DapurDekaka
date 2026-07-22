import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, orderStatusHistory } from '@/lib/db/schema';
import { createBiteshipOrder } from '@/lib/shipping/providers/biteship/orders';
import { buildRateItems } from '@/lib/shipping/providers/biteship/rates';
import { getSetting } from '@/lib/settings/get-settings';
import { WAREHOUSE_ORIGIN_LAT, WAREHOUSE_ORIGIN_LNG } from '@/lib/shipping/constants';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderShippedEmail } from '@/lib/resend/templates/OrderShipped';
import { sendWhatsApp, dispatchMessage, opsDispatchFailedMessage } from '@/lib/services/fonnte';
import { logger } from '@/lib/utils/logger';

const ALLOWED_DISPATCH = ['pending', 'failed', 'retrying'] as const;

export type DispatchStatusCode = 'booked' | 'conflict' | 'not_found' | 'failed';

export interface DispatchOutcome {
  readonly ok: boolean;
  readonly status: DispatchStatusCode;
  readonly message?: string;
  readonly biteshipOrderId?: string;
  readonly waybillId?: string | null;
  readonly trackingUrl?: string | null;
}

/**
 * Book a courier via Biteship for a packed delivery order.
 *
 * Session-free so it can be called directly by the warehouse route (after
 * auth) AND by the retry-dispatch cron (after CRON_SECRET auth) — no
 * empty-cookie self-fetch (P0#9).
 *
 * @param orderId          Order to dispatch.
 * @param changedByUserId  User id for the status-history row, or null for cron.
 */
export async function dispatchOrder(
  orderId: string,
  changedByUserId: string | null = null
): Promise<DispatchOutcome> {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { items: true },
  });

  if (!order) return { ok: false, status: 'not_found', message: 'Order tidak ditemukan' };
  if (order.status !== 'packed') {
    return { ok: false, status: 'conflict', message: 'Order harus berstatus packed sebelum dispatch' };
  }
  if (order.deliveryMethod !== 'delivery') {
    return { ok: false, status: 'conflict', message: 'Dispatch hanya untuk pengiriman' };
  }
  if (
    !order.dispatchStatus ||
    !ALLOWED_DISPATCH.includes(order.dispatchStatus as (typeof ALLOWED_DISPATCH)[number])
  ) {
    return { ok: false, status: 'conflict', message: 'Order tidak siap untuk dispatch' };
  }

  await db.update(orders).set({ dispatchStatus: 'booking', updatedAt: new Date() }).where(eq(orders.id, order.id));

  const originLat = (await getSetting<number>('biteship_origin_lat', 'number')) ?? WAREHOUSE_ORIGIN_LAT;
  const originLng = (await getSetting<number>('biteship_origin_lng', 'number')) ?? WAREHOUSE_ORIGIN_LNG;
  const originAddress =
    (await getSetting<string>('biteship_origin_address', 'string')) ?? 'Jl. Sinom V No. 7, Turangga, Bandung';
  const storePhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '6281234567890';

  const rateItems = buildRateItems(
    order.items.map((item) => ({
      name: item.productNameId,
      value: item.unitPrice,
      weightGram: item.weightGram,
      lengthCm: 30,
      widthCm: 22,
      heightCm: 12,
      quantity: item.quantity,
    }))
  );

  try {
    const result = await createBiteshipOrder({
      referenceId: order.orderNumber,
      courierCompany: order.courierCode ?? 'sicepat',
      courierType: order.courierService ?? 'REG',
      originLatitude: originLat,
      originLongitude: originLng,
      originAddress,
      originContactName: 'Dapur Dekaka',
      originContactPhone: storePhone,
      destinationLatitude: Number(order.latitude ?? 0),
      destinationLongitude: Number(order.longitude ?? 0),
      destinationAddress: order.addressLine ?? '',
      destinationContactName: order.recipientName,
      destinationContactPhone: order.recipientPhone,
      destinationPostalCode: order.postalCode ?? undefined,
      insuranceValue: order.insuranceType && order.insuranceType !== 'none' ? order.subtotal : undefined,
      items: rateItems,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dapurdekaka.com';
    const customerTrackUrl = `${appUrl}/orders/track/${order.orderNumber}`;
    const trackUrl = result.trackingUrl ?? customerTrackUrl;

    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({
          biteshipOrderId: result.biteshipOrderId,
          biteshipReferenceId: order.orderNumber,
          biteshipActualCost: result.actualCost,
          trackingNumber: result.waybillId,
          trackingUrl: trackUrl,
          liveTrackUrl: result.trackingUrl,
          dispatchStatus: 'booked',
          dispatchBookedAt: new Date(),
          dispatchLastError: null,
          status: 'shipped',
          shippedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: 'packed',
        toStatus: 'shipped',
        changedByUserId,
        changedByType: changedByUserId ? 'user' : 'system',
        note: `Courier booked via Biteship — AWB ${result.waybillId ?? 'pending'}`,
      });
    });

    sendEmail({
      to: order.recipientEmail,
      subject: `Pesanan ${order.orderNumber} sudah dikirim!`,
      react: OrderShippedEmail({
        orderNumber: order.orderNumber,
        customerName: order.recipientName,
        courierName: order.courierName ?? order.courierCode ?? 'Kurir',
        trackingNumber: result.waybillId ?? '-',
        trackingUrl: customerTrackUrl,
        estimatedDays: order.estimatedDays ?? '',
        items: order.items.map((i) => ({ name: i.productNameId, variant: i.variantNameId, quantity: i.quantity })),
        totalAmount: order.totalAmount,
      }),
    }).catch((err) => logger.error('[dispatch] email failed', { error: err instanceof Error ? err.message : String(err) }));

    sendWhatsApp({
      phone: order.recipientPhone,
      message: dispatchMessage({
        orderNumber: order.orderNumber,
        courier: order.courierName ?? order.courierCode ?? 'Kurir',
        awb: result.waybillId ?? '-',
        trackUrl: customerTrackUrl,
      }),
    }).catch(() => undefined);

    return {
      ok: true,
      status: 'booked',
      biteshipOrderId: result.biteshipOrderId,
      waybillId: result.waybillId,
      trackingUrl: trackUrl,
    };
  } catch (dispatchError) {
    const errMsg = dispatchError instanceof Error ? dispatchError.message : 'Dispatch gagal';
    const attempts = (order.dispatchAttempts ?? 0) + 1;

    await db
      .update(orders)
      .set({
        dispatchStatus: attempts >= 3 ? 'failed' : 'retrying',
        dispatchAttempts: attempts,
        dispatchLastError: errMsg,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    sendWhatsApp({
      phone: storePhone,
      message: opsDispatchFailedMessage({ orderNumber: order.orderNumber, error: errMsg }),
    }).catch(() => undefined);

    return { ok: false, status: 'failed', message: `Dispatch gagal: ${errMsg}` };
  }
}
