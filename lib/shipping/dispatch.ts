import * as Sentry from '@sentry/nextjs';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, orderStatusHistory, productVariants } from '@/lib/db/schema';
import { createBiteshipOrder } from '@/lib/shipping/providers/biteship/orders';
import { buildRateItems } from '@/lib/shipping/providers/biteship/rates';
import { getSetting } from '@/lib/settings/get-settings';
import { WAREHOUSE_ORIGIN_LAT, WAREHOUSE_ORIGIN_LNG } from '@/lib/shipping/constants';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderShippedEmail } from '@/lib/resend/templates/OrderShipped';
import { sendWhatsApp, dispatchMessage, opsDispatchFailedMessage } from '@/lib/services/fonnte';
import { scheduleBackground } from '@/lib/utils/background';
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

  // W2: claim the booking slot atomically. Two rapid clicks (or a click +
  // retry cron) must not create two Biteship orders.
  const [claimed] = await db
    .update(orders)
    .set({ dispatchStatus: 'booking', updatedAt: new Date() })
    .where(
      and(
        eq(orders.id, order.id),
        eq(orders.status, 'packed'),
        inArray(orders.dispatchStatus, ['pending', 'failed', 'retrying'])
      )
    )
    .returning({ id: orders.id });

  if (!claimed) {
    return { ok: false, status: 'conflict', message: 'Dispatch sedang diproses atau sudah dibooking' };
  }

  const originLat = (await getSetting<number>('biteship_origin_lat', 'number')) ?? WAREHOUSE_ORIGIN_LAT;
  const originLng = (await getSetting<number>('biteship_origin_lng', 'number')) ?? WAREHOUSE_ORIGIN_LNG;
  const originAddress =
    (await getSetting<string>('biteship_origin_address', 'string')) ?? '';

  // W1: booking with an empty origin address is rejected by Biteship or makes
  // the pickup impossible. Refuse early with an actionable message.
  if (!originAddress.trim()) {
    await db
      .update(orders)
      .set({
        dispatchStatus: 'failed',
        dispatchLastError: 'biteship_origin_address belum diisi',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));
    return {
      ok: false,
      status: 'failed',
      message: 'Alamat asal Biteship belum diisi. Lengkapi di Pengaturan → Pengiriman.',
    };
  }

  const dbStorePhone = await getSetting<string>('store_whatsapp_number').catch(() => null);
  const storePhone = dbStorePhone ?? '';

  // W3: use the real variant dimensions stored on the order (same values the
  // checkout quote used), otherwise Biteship re-prices the booking.
  const variantIds = [...new Set(order.items.map((item) => item.variantId))];
  const variantRows = variantIds.length
    ? await db
        .select({
          id: productVariants.id,
          lengthCm: productVariants.lengthCm,
          widthCm: productVariants.widthCm,
          heightCm: productVariants.heightCm,
        })
        .from(productVariants)
        .where(inArray(productVariants.id, variantIds))
    : [];
  const variantDims = new Map(variantRows.map((v) => [v.id, v]));

  const rateItems = buildRateItems(
    order.items.map((item) => {
      const dims = variantDims.get(item.variantId);
      return {
        name: item.productNameId,
        value: item.unitPrice,
        weightGram: item.weightGram,
        lengthCm: dims?.lengthCm ?? 30,
        widthCm: dims?.widthCm ?? 22,
        heightCm: dims?.heightCm ?? 12,
        quantity: item.quantity,
      };
    })
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
      cashOnDeliveryValue: order.cashOnDelivery ? order.totalAmount : undefined,
      cashOnDeliveryType: '7_days',
      items: rateItems,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.dapurdekaka.com';
    const customerTrackUrl = `${appUrl}/orders/track/${order.orderNumber}`;
    const trackUrl = result.trackingUrl ?? customerTrackUrl;

    // NOTE (audit #47): db now runs on neon-serverless Pool, so transactions
    // ARE available. These two writes stay sequential (not wrapped) on purpose:
    // the Biteship booking above is an irreversible external side effect, so a
    // DB transaction could not roll it back anyway. Status guards on the caller
    // side keep retries idempotent.
    await db
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

    await db.insert(orderStatusHistory).values({
      orderId: order.id,
      fromStatus: 'packed',
      toStatus: 'shipped',
      changedByUserId,
      changedByType: changedByUserId ? 'user' : 'system',
      note: `Courier booked via Biteship — AWB ${result.waybillId ?? 'pending'}`,
    });

    // Notify after booking succeeds — never fail dispatch on email/WA render errors
    scheduleBackground(
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
          items: order.items.map((i) => ({
            name: i.productNameId,
            variant: i.variantNameId,
            quantity: i.quantity,
          })),
          totalAmount: order.totalAmount,
        }),
      }),
      'dispatch shipped email'
    );

    scheduleBackground(
      sendWhatsApp({
        phone: order.recipientPhone,
        message: dispatchMessage({
          orderNumber: order.orderNumber,
          courier: order.courierName ?? order.courierCode ?? 'Kurir',
          awb: result.waybillId ?? '-',
          trackUrl: customerTrackUrl,
        }),
      }),
      'dispatch shipped WhatsApp'
    );

    return {
      ok: true,
      status: 'booked',
      biteshipOrderId: result.biteshipOrderId,
      waybillId: result.waybillId,
      trackingUrl: trackUrl,
    };
  } catch (dispatchError) {
    Sentry.captureException(dispatchError);
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

    if (storePhone) {
      scheduleBackground(
        sendWhatsApp({
          phone: storePhone,
          message: opsDispatchFailedMessage({ orderNumber: order.orderNumber, error: errMsg }),
        }),
        'dispatch failure WhatsApp'
      );
    }

    return { ok: false, status: 'failed', message: `Dispatch gagal: ${errMsg}` };
  }
}
