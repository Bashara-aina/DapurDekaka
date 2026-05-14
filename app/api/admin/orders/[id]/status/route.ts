import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderStatusHistory, orderItems, productVariants, users, coupons } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { success, unauthorized, forbidden, notFound, conflict, serverError } from '@/lib/utils/api-response';
import { isValidStatusTransition } from '@/lib/services/order.service';
import { restoreStock } from '@/lib/services/inventory.service';
import { earnPoints } from '@/lib/services/points.service';
import { z } from 'zod';

const UpdateStatusSchema = z.object({
  status: z.enum(['processing', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded']),
  note: z.string().max(500).optional(),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().url().optional(),
  estimatedDays: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const { id: orderId } = await params;
    const body = await req.json();
    const parsed = UpdateStatusSchema.safeParse(body);

    if (!parsed.success) {
      return conflict('Data tidak valid');
    }

    const { status: newStatus, note, trackingNumber, trackingUrl, estimatedDays } = parsed.data;

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return notFound('Pesanan tidak ditemukan');
    }

    if (!isValidStatusTransition(order.status, newStatus)) {
      return conflict(
        `Status tidak dapat diubah dari "${order.status}" ke "${newStatus}"`
      );
    }

    await db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updatedAt: new Date(),
      };

      if (newStatus === 'shipped') {
        updateData.shippedAt = new Date();
        if (trackingNumber) {
          updateData.trackingNumber = trackingNumber;
          updateData.trackingUrl = trackingUrl;
        }
        if (estimatedDays) {
          updateData.estimatedDays = estimatedDays;
        }
      } else if (newStatus === 'delivered') {
        updateData.deliveredAt = new Date();
      } else if (newStatus === 'cancelled') {
        updateData.cancelledAt = new Date();
      }

      await tx.update(orders).set(updateData).where(eq(orders.id, orderId));

      await tx.insert(orderStatusHistory).values({
        orderId,
        fromStatus: order.status as any,
        toStatus: newStatus as any,
        changedByUserId: session.user.id,
        changedByType: 'admin',
        note: note ?? null,
      });

      if (newStatus === 'cancelled' && order.status === 'paid') {
        const items = await tx
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));

        for (const item of items) {
          await tx
            .update(productVariants)
            .set({
              stock: sql`stock + ${item.quantity}`,
            })
            .where(eq(productVariants.id, item.variantId));
        }

        if (order.pointsUsed && order.pointsUsed > 0 && order.userId) {
          await tx
            .update(users)
            .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
            .where(eq(users.id, order.userId));
        }

        if (order.couponId) {
          await tx
            .update(coupons)
            .set({ usedCount: sql`GREATEST(used_count - 1, 0)` })
            .where(eq(coupons.id, order.couponId));
        }
      }
    });

    const updatedOrder = await db
      .select({ status: orders.status, shippedAt: orders.shippedAt, deliveredAt: orders.deliveredAt, cancelledAt: orders.cancelledAt })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    return success({
      orderId,
      orderNumber: order.orderNumber,
      status: updatedOrder[0]?.status ?? newStatus,
      shippedAt: updatedOrder[0]?.shippedAt ?? null,
      deliveredAt: updatedOrder[0]?.deliveredAt ?? null,
      cancelledAt: updatedOrder[0]?.cancelledAt ?? null,
      message: `Status pesanan berhasil diperbarui ke "${newStatus}"`,
    });
  } catch (error) {
    console.error('[admin/orders/status]', error);
    return serverError(error);
  }
}