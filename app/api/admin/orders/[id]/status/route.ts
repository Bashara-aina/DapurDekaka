import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderItems, productVariants, inventoryLogs, coupons, pointsHistory, users, orderStatusHistory } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { success, serverError, notFound, forbidden, conflict } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderShippedEmail } from '@/lib/resend/templates/OrderShipped';
import { OrderDeliveredEmail } from '@/lib/resend/templates/OrderDelivered';
import { OrderCancellationEmail } from '@/lib/resend/templates/OrderCancellation';
import { formatWIB } from '@/lib/utils/format-date';
import { logAdminActivity } from '@/lib/services/audit.service';

const statusUpdateSchema = z.object({
  status: z.enum(['processing', 'packed', 'shipped', 'delivered', 'cancelled']),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().optional(),
  estimatedDays: z.string().optional(),
  cancellationReason: z.string().optional(),
}).refine(
  (data) => data.status !== 'shipped' || (!!data.trackingNumber && data.trackingNumber.trim().length > 0),
  { message: 'Nomor resi harus diisi untuk mengubah status ke shipped', path: ['trackingNumber'] }
);

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ['cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
};

// Warehouse can only do packed→shipped
const WAREHOUSE_TRANSITIONS = ['shipped'];

// Superadmin/owner can do all transitions
const ADMIN_TRANSITIONS = ['processing', 'packed', 'shipped', 'delivered', 'cancelled'];

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
      return NextResponse.json(
        {
          success: false,
          error: 'Validasi gagal',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
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

    // All status transitions (including cancellation) happen in a transaction
    // to ensure order update, status history, and financial reversals are atomic
    await db.transaction(async (tx) => {
      // Apply status update
      await tx.update(orders).set(updateData).where(eq(orders.id, orderId));

      // Write order status history for every transition
      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: currentStatus as any,
        toStatus: newStatus as any,
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
                stock: sql`stock + ${item.quantity}`,
                updatedAt: new Date(),
              })
              .where(eq(productVariants.id, item.variantId))
              .returning({ newStock: productVariants.stock });

            if (result[0]) {
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
        }

        // Points/coupon reversal is always safe to do (idempotent)
        if (order.userId && order.pointsUsed > 0) {
          await tx
            .update(users)
            .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
            .where(eq(users.id, order.userId));

          await tx.insert(pointsHistory).values({
            userId: order.userId,
            type: 'expire',
            pointsAmount: -order.pointsUsed,
            pointsBalanceAfter: sql`points_balance + ${order.pointsUsed}`,
            descriptionId: `Pembatalan pesanan ${order.orderNumber} — poin dikembalikan`,
            descriptionEn: `Order ${order.orderNumber} cancelled — points returned`,
            expiresAt: null,
            isExpired: false,
          });
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
      try {
        const emailHtml = OrderShippedEmail({
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
        });

        await sendEmail({
          to: order.recipientEmail,
          subject: `Pesanan ${order.orderNumber} sudah dikirim!`,
          react: emailHtml,
        });
      } catch (emailError) {
        console.error('[Status Update] Failed to send shipped email:', emailError);
      }
    }

    if (newStatus === 'delivered') {
      try {
        const emailHtml = OrderDeliveredEmail({
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
        });

        await sendEmail({
          to: order.recipientEmail,
          subject: `Pesanan ${order.orderNumber} sudah diterima! Terima kasih — Dapur Dekaka`,
          react: emailHtml,
        });
      } catch (emailError) {
        console.error('[Status Update] Failed to send delivered email:', emailError);
      }
    }

    if (newStatus === 'cancelled') {
      try {
        const reason = cancellationReason ?? 'Dibatalkan oleh admin';
        const cancellationEmailHtml = OrderCancellationEmail({
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
        });

        await sendEmail({
          to: order.recipientEmail,
          subject: `Pesanan ${order.orderNumber} dibatalkan`,
          react: cancellationEmailHtml,
        });
      } catch (emailError) {
        console.error('[Status Update] Failed to send cancellation email:', emailError);
      }
    }

    // Audit log — non-blocking
    logAdminActivity({
      userId: session.user.id,
      action: `order_status_${newStatus}`,
      targetType: 'order',
      targetId: order.id,
      beforeState: { status: currentStatus },
      afterState: { status: newStatus },
    }).catch((e) => console.error('[Audit] Failed to log order status change:', e));

    return success({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: newStatus,
      shippedAt: newStatus === 'shipped' ? new Date() : null,
      deliveredAt: newStatus === 'delivered' ? new Date() : null,
    });
  } catch (error) {
    console.error('[admin/orders/status]', error);
    return serverError(error);
  }
}