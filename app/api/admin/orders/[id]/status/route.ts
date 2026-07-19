import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderItems, productVariants, inventoryLogs, coupons, pointsHistory, users, orderStatusHistory } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { success, serverError, notFound, forbidden, conflict, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { z, ZodError } from 'zod';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderShippedEmail } from '@/lib/resend/templates/OrderShipped';
import { OrderDeliveredEmail } from '@/lib/resend/templates/OrderDelivered';
import { OrderCancellationEmail } from '@/lib/resend/templates/OrderCancellation';
import { formatWIB } from '@/lib/utils/format-date';
import { logAdminActivity } from '@/lib/services/audit.service';
import { refundTransaction } from '@/lib/midtrans/status';
import { TRACKING_FORMATS, ALLOWED_COURIER_CODES } from '@/lib/constants/couriers';
import { logger } from '@/lib/utils/logger';

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

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ['cancelled'],
  paid: ['processing', 'cancelled', 'refunded'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
};

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

    const { status: newStatus, trackingNumber, trackingUrl, estimatedDays, cancellationReason } = parsed.data;

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { items: true },
    });

    if (!order) {
      return notFound('Order tidak ditemukan');
    }

    const currentStatus = order.status;
    const allowedTransitions = VALID_TRANSITIONS[currentStatus];

    // Pickup orders skip packed/shipped statuses
    if (order.deliveryMethod === 'pickup') {
      const PICKUP_VALID_TRANSITIONS: Record<string, string[]> = {
        pending_payment: ['cancelled'],
        paid: ['processing', 'cancelled'],
        processing: ['delivered', 'cancelled'],
      };
      const allowedForPickup = PICKUP_VALID_TRANSITIONS[currentStatus] ?? [];
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

        // P0-09: If order was paid via Midtrans and has a transaction ID, call refund API
        // Only Midtrans orders can be refunded — Net-30 B2B orders have no Midtrans transaction
        if (order.paymentMethod === 'midtrans' && order.midtransTransactionId && ['paid', 'processing', 'packed', 'shipped', 'delivered'].includes(currentStatus)) {
          const refundResult = await refundTransaction(order.midtransTransactionId, order.totalAmount);
          if (!refundResult.success) {
            throw new Error(`REFUND_FAILED:${refundResult.error ?? 'Unknown error'}`);
          }
        }

        // Points/coupon reversal is always safe to do (idempotent)
        if (order.userId && order.pointsUsed > 0) {
          // BUG-12: Find the original redeem record to unconsume FIFO earn records
          const redeemRecords = await tx.query.pointsHistory.findMany({
            where: and(
              eq(pointsHistory.orderId, orderId),
              eq(pointsHistory.type, 'redeem'),
              sql`${pointsHistory.referencedEarnId} IS NOT NULL`
            ),
          });

          // Unconsume FIFO earn records if referenced
          for (const redeem of redeemRecords) {
            if (redeem.referencedEarnId) {
              await tx
                .update(pointsHistory)
                .set({ consumedAt: null })
                .where(eq(pointsHistory.id, redeem.referencedEarnId));
            }
          }

          const [updatedUser] = await tx
            .update(users)
            .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
            .where(eq(users.id, order.userId))
            .returning({ pointsBalance: users.pointsBalance });

          const newBalance = updatedUser?.pointsBalance ?? 0;

          await tx.insert(pointsHistory).values({
            userId: order.userId,
            type: 'adjust',
            pointsAmount: order.pointsUsed,
            pointsBalanceAfter: newBalance,
            descriptionId: `Pembatalan pesanan ${order.orderNumber} — poin dikembalikan`,
            descriptionEn: `Order ${order.orderNumber} cancelled — points returned`,
            orderId: orderId,
            expiresAt: null,
            isExpired: false,
          });
        }

        // Reverse pointsEarned if order was already paid (BUG-02)
        const statusesThatEarnedPoints = ['paid', 'processing', 'packed', 'shipped', 'delivered'];
        if (order.userId && order.pointsEarned > 0 && statusesThatEarnedPoints.includes(currentStatus)) {
          const earnRecord = await tx.query.pointsHistory.findFirst({
            where: and(
              eq(pointsHistory.orderId, orderId),
              eq(pointsHistory.type, 'earn'),
              eq(pointsHistory.userId, order.userId),
            ),
          });

          if (earnRecord && !earnRecord.consumedAt) {
            const [updatedUser] = await tx
              .update(users)
              .set({ pointsBalance: sql`GREATEST(points_balance - ${order.pointsEarned}, 0)` })
              .where(eq(users.id, order.userId))
              .returning({ pointsBalance: users.pointsBalance });

            await tx.insert(pointsHistory).values({
              userId: order.userId,
              type: 'adjust',
              pointsAmount: -order.pointsEarned,
              pointsBalanceAfter: updatedUser?.pointsBalance ?? 0,
              descriptionId: `Poin dicabut — pembatalan pesanan ${order.orderNumber}`,
              descriptionEn: `Points reversed — order ${order.orderNumber} cancelled`,
              orderId: orderId,
            });

            await tx.update(pointsHistory)
              .set({ consumedAt: new Date() })
              .where(eq(pointsHistory.id, earnRecord.id));
          }
        }

        // Reverse coupon usage
        if (order.couponId) {
          await tx
            .update(coupons)
            .set({ usedCount: sql`GREATEST(used_count - 1, 0)` })
            .where(eq(coupons.id, order.couponId));
        }
      }
    });

    if (newStatus === 'shipped' && trackingNumber) {
      sendEmail({
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
      }).catch((emailError) => {
        logger.error('[Email] Failed to send shipped email', { error: emailError instanceof Error ? emailError.message : String(emailError) });
      });
    }

    if (newStatus === 'delivered') {
      sendEmail({
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
      }).catch((emailError) => {
        logger.error('[Email] Failed to send delivered email', { error: emailError instanceof Error ? emailError.message : String(emailError) });
      });
    }

    if (newStatus === 'cancelled') {
      const reason = cancellationReason ?? 'Dibatalkan oleh admin';
      const isPaidOrder = ['paid', 'processing', 'packed', 'shipped', 'delivered'].includes(currentStatus);
      sendEmail({
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
      }).catch((emailError) => {
        logger.error('[Email] Failed to send cancellation email', { error: emailError instanceof Error ? emailError.message : String(emailError) });
      });
    }

    // Audit log — non-blocking
    logAdminActivity({
      userId: session.user.id,
      action: `order_status_${newStatus}`,
      targetType: 'order',
      targetId: order.id,
      beforeState: { status: currentStatus },
      afterState: { status: newStatus },
    }).catch((e) => logger.error('[Audit] Failed to log order status change', { error: e instanceof Error ? e.message : String(e) }));

    return success({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: newStatus,
      shippedAt: newStatus === 'shipped' ? new Date() : null,
      deliveredAt: newStatus === 'delivered' ? new Date() : null,
    });
  } catch (error) {
    logger.error('[admin/orders/status]', { error: error instanceof Error ? error.message : String(error) });
    if (error instanceof Error && error.message === 'ORDER_STATUS_CHANGED_CONCURRENTLY') {
      return conflict('Status pesanan telah diubah oleh pengguna lain. Silakan refresh dan coba lagi.');
    }
    if (error instanceof Error && error.message.startsWith('REFUND_FAILED:')) {
      const refundError = error.message.replace('REFUND_FAILED:', '');
      return conflict('Refund gagal: ' + refundError + '. Pesanan tidak dibatalkan.');
    }
    return serverError(error);
  }
}