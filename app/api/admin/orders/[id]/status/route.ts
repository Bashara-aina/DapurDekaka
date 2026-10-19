import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { orders, orderItems, productVariants, inventoryLogs, coupons, couponUsages, refunds, orderStatusHistory } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { success, serverError, notFound, forbidden, conflict, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { sendEmail } from '@/lib/resend/send-email';
import { cancelBiteshipOrder } from '@/lib/shipping/providers/biteship/orders';
import { OrderShippedEmail } from '@/lib/resend/templates/OrderShipped';
import { OrderDeliveredEmail } from '@/lib/resend/templates/OrderDelivered';
import { OrderCancellationEmail } from '@/lib/resend/templates/OrderCancellation';
import { formatWIB } from '@/lib/utils/format-date';
import { sendPickupReadyNotification } from '@/lib/services/pickup-ready';
import { logAdminActivity } from '@/lib/services/audit.service';
import { refundTransaction } from '@/lib/midtrans/status';
import { cancelTransaction } from '@/lib/midtrans/status';
import { reverseRedeemedPointsTx, clawbackEarnedPointsTx } from '@/lib/finance/points-ledger';
import { ALLOWED_COURIER_CODES } from '@/lib/constants/couriers';
import { logger } from '@/lib/utils/logger';
import { scheduleBackground } from '@/lib/utils/background';
import { getClientIp, getUserAgent } from '@/lib/utils/request-meta';

type OrderStatus = 'pending_payment' | 'paid' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const statusUpdateSchema = z.object({
  status: z.enum(['processing', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded']),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().optional(),
  estimatedDays: z.string().optional(),
  cancellationReason: z.string().optional(),
  courierCode: z.string().optional(),
}).refine(
  (data) => data.status !== 'shipped' || (!!data.trackingNumber && data.trackingNumber.trim().length > 0),
  { message: 'Nomor resi harus diisi untuk mengubah status ke shipped', path: ['trackingNumber'] }
).refine(
  (data) => !data.courierCode || (ALLOWED_COURIER_CODES as readonly string[]).includes(data.courierCode.toLowerCase()),
  { message: 'Kurir tidak valid — hanya kurir cold-chain yang diperbolehkan', path: ['courierCode'] }
);

import { ORDER_TRANSITIONS } from '@/lib/constants/orders';

const VALID_TRANSITIONS: Record<string, string[]> = ORDER_TRANSITIONS.delivery;

// Warehouse can only do packed→shipped
const WAREHOUSE_TRANSITIONS = ['shipped'];

// Superadmin/owner can do all transitions (including refund after Midtrans refund succeeds)
const ADMIN_TRANSITIONS = ['processing', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return forbidden('Anda tidak memiliki akses ke fitur ini');
    }

    const { id: orderId } = await params;
    const body = await req.json();
    const parsed = statusUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { status: newStatus, trackingNumber, trackingUrl, estimatedDays, cancellationReason, courierCode } = parsed.data;

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { items: true },
    });

    if (!order) {
      return notFound('Order tidak ditemukan');
    }

    const currentStatus = order.status;
    const allowedTransitions = VALID_TRANSITIONS[currentStatus];

    // W10: pickup orders use the SAME state machine as delivery through
    // `packed` (ready for pickup), then delivered.
    if (order.deliveryMethod === 'pickup') {
      const allowedForPickup = ORDER_TRANSITIONS.pickup[currentStatus] ?? [];
      if (!allowedForPickup.includes(newStatus)) {
        return conflict(`Tidak dapat mengubah status pickup dari ${currentStatus} ke ${newStatus}`);
      }
    } else if (!allowedTransitions?.includes(newStatus)) {
      return conflict(`Tidak dapat mengubah status dari ${currentStatus} ke ${newStatus}`);
    }

    // Warehouse can only do packed→shipped
    if (role === 'warehouse' && !WAREHOUSE_TRANSITIONS.includes(newStatus)) {
      return forbidden('Warehouse hanya dapat mengubah status ke shipped');
    }

    // Build update payload and timestamps
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (newStatus === 'shipped') {
      updateData.shippedAt = new Date();
      if (trackingNumber) updateData.trackingNumber = trackingNumber;
      if (trackingUrl) updateData.trackingUrl = trackingUrl;
      if (estimatedDays) updateData.estimatedDays = estimatedDays;
    } else if (newStatus === 'delivered') {
      updateData.deliveredAt = new Date();
    } else if (newStatus === 'cancelled') {
      updateData.cancelledAt = new Date();
    }

    // M5/W7: cancelling a shipped order requires the courier to be stopped.
    // If Biteship refuses, do NOT cancel locally while the box is in transit.
    if (newStatus === 'cancelled' && currentStatus === 'shipped' && order.biteshipOrderId) {
      try {
        await cancelBiteshipOrder(
          order.biteshipOrderId,
          'others',
          cancellationReason ?? 'Dibatalkan oleh admin'
        );
      } catch (biteshipErr) {
        logger.error('[Biteship] Cancel failed — aborting order cancel', {
          orderId: order.id,
          biteshipOrderId: order.biteshipOrderId,
          error: biteshipErr instanceof Error ? biteshipErr.message : String(biteshipErr),
        });
        return conflict(
          'Gagal membatalkan pengiriman di Biteship. Hubungi kurir/Biteship sebelum membatalkan pesanan.'
        );
      }
    }

    // All status transitions happen in a transaction
    // to ensure order update, status history, and financial reversals are atomic.
    // P0-09: For paid orders being cancelled, Midtrans refund is called inside the
    // transaction body (after the optimistic lock) using midtransTransactionId.
    await db.transaction(async (tx) => {
      // Apply status update with optimistic lock — fails if status changed concurrently
      const [updatedOrder] = await tx
        .update(orders)
        .set(updateData)
        .where(and(
          eq(orders.id, orderId),
          eq(orders.status, currentStatus as OrderStatus),
        ))
        .returning({ id: orders.id, status: orders.status });

      if (!updatedOrder) {
        throw new Error('ORDER_STATUS_CHANGED_CONCURRENTLY');
      }

      // Write order status history for every transition
      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: currentStatus as OrderStatus,
        toStatus: newStatus as OrderStatus,
        changedByUserId: session.user.id,
        changedByType: 'admin',
        note: newStatus === 'cancelled'
          ? (cancellationReason ?? 'Dibatalkan oleh admin')
          : `Status diubah ke ${newStatus} oleh admin`,
      });

      // If cancelling, restore stock + reverse points + reverse coupon
      if (newStatus === 'cancelled') {
        // Only restore stock if order was already PAID (stock was deducted at settlement)
        // pending_payment orders never had stock deducted — no stock to restore
        const statusesThatDeductedStock = ['paid', 'processing', 'packed', 'shipped', 'delivered'];
        if (statusesThatDeductedStock.includes(currentStatus)) {
          for (const item of order.items) {
            const result = await tx
              .update(productVariants)
              .set({
                stock: sql`GREATEST(stock + ${item.quantity}, 0)`,
                updatedAt: new Date(),
              })
              .where(eq(productVariants.id, item.variantId))
              .returning({ newStock: productVariants.stock });

            if (!result[0]) {
              throw new Error(`Stock restoration failed: variant ${item.variantId} not found`);
            }

            await tx.insert(inventoryLogs).values({
              variantId: item.variantId,
              changeType: 'reversal',
              quantityBefore: result[0].newStock - item.quantity,
              quantityAfter: result[0].newStock,
              quantityDelta: item.quantity,
              orderId: order.id,
              note: `Pembatalan pesanan ${order.orderNumber} oleh admin`,
            });
          }
        }

        // C4: refunds never block cancellation. Midtrans' API only supports
        // card/GoPay/ShopeePay/QRIS refunds — VA cannot be refunded via API.
        // Always create a refund obligation and let the Refunds page drive the
        // API refund or a manual bank transfer.
        const wasPaid = order.paidAt !== null;
        if (wasPaid && order.totalAmount > 0) {
          const existingRefund = await tx.query.refunds.findFirst({
            where: eq(refunds.orderId, orderId),
            columns: { id: true },
          });
          if (!existingRefund) {
            await tx.insert(refunds).values({
              orderId,
              amount: order.totalAmount,
              reason: 'customer_request',
              method:
                order.paymentMethod === 'midtrans' && order.midtransOrderId
                  ? 'midtrans'
                  : 'manual',
              status: 'pending',
              initiatedBy: session.user.id,
              notes: `Dibatalkan oleh admin: ${cancellationReason ?? 'tanpa alasan'}`,
              // Method tells the Refunds UI how to settle it.
            });
          }
        }

        // P1: reverse points with ledger rows (idempotent helpers).
        await reverseRedeemedPointsTx(tx, order);
        if (wasPaid) {
          await clawbackEarnedPointsTx(tx, order, {
            ratio: 1,
            reasonId: `Poin dicabut — pembatalan pesanan ${order.orderNumber}`,
            reasonEn: `Points reversed — order ${order.orderNumber} cancelled`,
          });
        }

        // M3/K4: used_count was only incremented at settlement. Decrement it
        // only for paid orders; always remove the provisional usage row.
        if (order.couponId) {
          if (wasPaid) {
            await tx
              .update(coupons)
              .set({ usedCount: sql`GREATEST(used_count - 1, 0)` })
              .where(eq(coupons.id, order.couponId));
          }
          await tx.delete(couponUsages).where(eq(couponUsages.orderId, orderId));
        }
      }
    });

    // Post-commit side effects (never inside the DB transaction).
    if (newStatus === 'cancelled') {
      const wasPaid = order.paidAt !== null;
      if (wasPaid && order.paymentMethod === 'midtrans' && order.midtransOrderId) {
        // Best-effort API refund; a failure leaves the obligation pending for
        // manual handling instead of blocking the cancellation. Midtrans'
        // refund endpoint keys on order_id (not transaction_id).
        const refundResult = await refundTransaction(order.midtransOrderId, order.totalAmount);
        if (refundResult.success) {
          await db
            .update(refunds)
            .set({
              status: 'completed',
              processedAt: new Date(),
              midtransRefundId: refundResult.refundId ?? null,
              updatedAt: new Date(),
            })
            .where(eq(refunds.orderId, orderId));
        } else {
          logger.warn('[admin/orders/status] Midtrans refund failed — left pending', {
            orderNumber: order.orderNumber,
            error: refundResult.error,
          });
        }
      } else if (!wasPaid && order.midtransOrderId) {
        // M4: stop the customer from paying a VA after the order was cancelled.
        const cancelledTx = await cancelTransaction(order.midtransOrderId);
        if (!cancelledTx.success) {
          logger.warn('[admin/orders/status] Midtrans cancel failed', {
            orderNumber: order.orderNumber,
            error: cancelledTx.error,
          });
        }
      }
    }

    // W8: when Biteship booked the shipment, dispatchOrder() already sent the
    // shipped email — do not send a second one from the manual transition.
    if (newStatus === 'shipped' && trackingNumber && !order.biteshipOrderId) {
      scheduleBackground(sendEmail({
        to: order.recipientEmail,
        subject: `Pesanan ${order.orderNumber} sudah dikirim!`,
        react: OrderShippedEmail({
          orderNumber: order.orderNumber,
          customerName: order.recipientName,
          courierName: order.courierName ?? 'Pengiriman',
          trackingNumber,
          trackingUrl: trackingUrl ?? '',
          estimatedDays: estimatedDays ?? '',
          items: order.items.map((item) => ({
            name: item.productNameId,
            variant: item.variantNameId,
            quantity: item.quantity,
          })),
          totalAmount: order.totalAmount,
        }),
      }), 'admin shipped email');
    }

    // W11/M12: pickup "ready" notification fires when the order is packed.
    if (newStatus === 'packed' && order.deliveryMethod === 'pickup') {
      await sendPickupReadyNotification(order);
    }

    if (newStatus === 'delivered') {
      scheduleBackground(sendEmail({
        to: order.recipientEmail,
        subject: `Pesanan ${order.orderNumber} sudah diterima! Terima kasih — Dapur Dekaka`,
        react: OrderDeliveredEmail({
          orderNumber: order.orderNumber,
          customerName: order.recipientName,
          pointsEarned: order.pointsEarned ?? 0,
          items: order.items.map((item) => ({
            name: item.productNameId,
            variant: item.variantNameId,
            quantity: item.quantity,
          })),
          totalAmount: order.totalAmount,
          deliveredAt: formatWIB(new Date()),
        }),
      }), 'admin delivered email');
    }

    if (newStatus === 'cancelled') {
      const reason = cancellationReason ?? 'Dibatalkan oleh admin';
      const isPaidOrder = order.paidAt !== null;
      scheduleBackground(sendEmail({
        to: order.recipientEmail,
        subject: `Pesanan ${order.orderNumber} dibatalkan`,
        react: OrderCancellationEmail({
          orderNumber: order.orderNumber,
          customerName: order.recipientName,
          items: order.items.map((item) => ({
            name: item.productNameId,
            variant: item.variantNameId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          })),
          subtotal: order.subtotal,
          shippingCost: order.shippingCost,
          discountAmount: order.discountAmount,
          totalAmount: order.totalAmount,
          reason,
          cancelledAt: formatWIB(new Date()),
          refundAmount: isPaidOrder ? order.totalAmount : 0,
          refundInfo: isPaidOrder ? 'Refund akan diproses dalam 3-5 hari kerja ke metode pembayaran asal Anda.' : undefined,
        }),
      }), 'admin cancellation email');
    }

    // Audit log — non-blocking, captures IP/UA for compliance.
    logAdminActivity({
      userId: session.user.id,
      action: `order_status_${newStatus}`,
      targetType: 'order',
      targetId: order.id,
      beforeState: { status: currentStatus },
      afterState: { status: newStatus, courierCode: courierCode ?? null, trackingNumber: trackingNumber ?? null },
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    return success({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: newStatus,
      shippedAt: newStatus === 'shipped' ? new Date() : null,
      deliveredAt: newStatus === 'delivered' ? new Date() : null,
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error('[admin/orders/status]', { error: error instanceof Error ? error.message : String(error) });
    if (error instanceof Error && error.message === 'ORDER_STATUS_CHANGED_CONCURRENTLY') {
      return conflict('Status pesanan telah diubah oleh pengguna lain. Silakan refresh dan coba lagi.');
    }
    return serverError(error);
  }
}