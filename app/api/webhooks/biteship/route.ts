import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderStatusHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { success, serverError } from '@/lib/utils/api-response';
import {
  verifyBiteshipWebhookSignature,
  parseBiteshipWebhook,
  biteshipEventId,
} from '@/lib/shipping/providers/biteship/webhook';
import { mapBiteshipStatusToOrder } from '@/lib/shipping/providers/biteship/tracking';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderDeliveredEmail } from '@/lib/resend/templates/OrderDelivered';
import { sendWhatsApp, deliveredMessage, opsDispatchFailedMessage } from '@/lib/services/fonnte';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { recordWebhookEvent } from '@/lib/utils/webhook-events';
import { isAlreadyProcessed, markProcessed, buildWebhookIdempotencyKey } from '@/lib/utils/webhook-idempotency';

export const runtime = 'nodejs';

export const POST = withRateLimit(
  async (req: NextRequest) => {
    try {
      const rawBody = await req.text();
      const signature = req.headers.get('x-biteship-signature');

      if (!verifyBiteshipWebhookSignature(rawBody, signature)) {
        await recordWebhookEvent({
          source: 'biteship',
          eventType: 'invalid_signature',
          errorMessage: 'invalid_signature',
        });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }

      const payload = parseBiteshipWebhook(rawBody);
      if (!payload) {
        await recordWebhookEvent({
          source: 'biteship',
          eventType: 'invalid_payload',
          errorMessage: 'invalid_payload',
        });
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
      }

      const eventId = biteshipEventId(payload);
      const idempotencyKey = buildWebhookIdempotencyKey('biteship', eventId, payload.status ?? '');
      if (await isAlreadyProcessed(idempotencyKey)) {
        return success({ received: true, note: 'already_processed' });
      }

      const order = await db.query.orders.findFirst({
        where: payload.reference_id
          ? eq(orders.orderNumber, payload.reference_id)
          : eq(orders.biteshipOrderId, payload.order_id ?? ''),
        with: { statusHistory: true },
      });

      if (!order) {
        await recordWebhookEvent({
          source: 'biteship',
          eventType: payload.status ?? 'unknown',
          externalId: payload.reference_id ?? payload.order_id ?? null,
          payload,
          errorMessage: 'order_not_found',
        });
        return NextResponse.json({ received: false }, { status: 404 });
      }

      const alreadyHandled = order.statusHistory.some(
        (h) =>
          h.metadata &&
          typeof h.metadata === 'object' &&
          'biteshipEventId' in (h.metadata as Record<string, unknown>) &&
          (h.metadata as Record<string, unknown>).biteshipEventId === eventId
      );

      if (alreadyHandled) {
        await markProcessed(idempotencyKey);
        return success({ received: true, note: 'already_processed' });
      }

      const mapped = payload.status
        ? mapBiteshipStatusToOrder(payload.status)
        : null;

      const driverUpdate = {
        driverName: payload.courier_driver_name ?? order.driverName,
        driverPhone: payload.courier_driver_phone ?? order.driverPhone,
        driverPlate: payload.courier_driver_plate_number ?? order.driverPlate,
        liveTrackUrl: payload.courier_link ?? order.liveTrackUrl,
        trackingNumber: payload.courier_waybill_id ?? order.trackingNumber,
      };

      // Handle order.price event: update actual cost when weight differs
      if (payload.event === 'order.price' && payload.price != null && payload.price !== order.biteshipActualCost) {
        await db
          .update(orders)
          .set({ biteshipActualCost: payload.price, updatedAt: new Date() })
          .where(eq(orders.id, order.id));

        await recordWebhookEvent({
          source: 'biteship',
          eventType: 'order.price',
          externalId: order.orderNumber,
          payload,
          errorMessage: `actual_cost_updated: ${order.biteshipActualCost} -> ${payload.price}`,
        });
      }

      if (mapped === 'failed') {
        await db.transaction(async (tx) => {
          await tx
            .update(orders)
            .set({
              ...driverUpdate,
              dispatchStatus: 'failed',
              dispatchLastError: `Biteship status: ${payload.status}`,
              updatedAt: new Date(),
            })
            .where(eq(orders.id, order.id));

          await tx.insert(orderStatusHistory).values({
            orderId: order.id,
            fromStatus: order.status,
            toStatus: order.status,
            changedByType: 'system',
            note: `Biteship webhook: ${payload.status}`,
            metadata: { biteshipEventId: eventId, biteshipStatus: payload.status },
          });
        });

        const storePhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '';
        if (storePhone) {
          sendWhatsApp({
            phone: storePhone,
            message: opsDispatchFailedMessage({
              orderNumber: order.orderNumber,
              error: payload.status ?? 'cancelled',
            }),
          }).catch(() => undefined);
        }

        await recordWebhookEvent({
          source: 'biteship',
          eventType: payload.status ?? 'failed',
          externalId: order.orderNumber,
          payload,
          errorMessage: `dispatch_failed:${payload.status ?? 'unknown'}`,
        });

        await markProcessed(idempotencyKey);
        return success({ received: true });
      }

      if (mapped === 'shipped' && order.status === 'packed') {
        await db.transaction(async (tx) => {
          await tx
            .update(orders)
            .set({
              ...driverUpdate,
              status: 'shipped',
              shippedAt: new Date(),
              dispatchStatus: 'booked',
              updatedAt: new Date(),
            })
            .where(eq(orders.id, order.id));

          await tx.insert(orderStatusHistory).values({
            orderId: order.id,
            fromStatus: 'packed',
            toStatus: 'shipped',
            changedByType: 'system',
            note: `Biteship: ${payload.status}`,
            metadata: { biteshipEventId: eventId },
          });
        });
      } else if (mapped === 'delivered') {
        await db.transaction(async (tx) => {
          await tx
            .update(orders)
            .set({
              ...driverUpdate,
              status: 'delivered',
              deliveredAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(orders.id, order.id));

          await tx.insert(orderStatusHistory).values({
            orderId: order.id,
            fromStatus: order.status,
            toStatus: 'delivered',
            changedByType: 'system',
            note: 'Pesanan diterima',
            metadata: { biteshipEventId: eventId },
          });
        });

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dapurdekaka.com';
        sendEmail({
          to: order.recipientEmail,
          subject: `Pesanan ${order.orderNumber} telah sampai!`,
          react: OrderDeliveredEmail({
            orderNumber: order.orderNumber,
            customerName: order.recipientName,
            trackPageUrl: `${appUrl}/orders/track/${order.orderNumber}`,
          }),
        }).catch((err) => logger.error('[biteship webhook] delivered email', { err }));

        sendWhatsApp({
          phone: order.recipientPhone,
          message: deliveredMessage(order.orderNumber),
        }).catch(() => undefined);
      } else {
        await db
          .update(orders)
          .set({ ...driverUpdate, updatedAt: new Date() })
          .where(eq(orders.id, order.id));
      }

      await recordWebhookEvent({
        source: 'biteship',
        eventType: payload.status ?? 'unknown',
        externalId: order.orderNumber,
        payload,
      });

      await markProcessed(idempotencyKey);
      return success({ received: true });
    } catch (error) {
      logger.error('[biteship webhook]', { error });
      return serverError(error);
    }
  },
  'webhook'
);
