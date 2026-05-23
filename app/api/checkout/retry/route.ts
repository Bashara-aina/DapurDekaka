import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq, and, sql } from 'drizzle-orm';
import { orders, orderItems, productVariants, inventoryLogs, coupons, couponUsages, pointsHistory, users, orderStatusHistory } from '@/lib/db/schema';
import { success, serverError, notFound, conflict, unauthorized, forbidden, validationError, tooManyRequests } from '@/lib/utils/api-response';
import { z } from 'zod';
import { createMidtransTransaction } from '@/lib/midtrans/create-transaction';
import { formatWIB } from '@/lib/utils/format-date';
import { getSetting } from '@/lib/settings/get-settings';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/utils/logger';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const retrySchema = z.object({
  orderNumber: z.string().regex(/^DDK-\d{8}-\d{4}(?:-retry-\d+)?$/, 'Format orderNumber tidak valid'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const parsed = retrySchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { orderNumber } = parsed.data;

    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, orderNumber),
      with: { items: true },
    });

    if (!order) {
      return notFound('Order tidak ditemukan');
    }

    // Auth: must be owner of order OR superadmin/owner
    if (session?.user?.id && order.userId && session.user.id !== order.userId) {
      const role = (session.user as { role?: string }).role;
      if (role !== 'superadmin' && role !== 'owner') {
        return forbidden('Anda tidak berhak mengakses pesanan ini');
      }
    }

    if (order.status !== 'pending_payment') {
      return conflict('Order tidak dapat diretry — status bukan pending_payment');
    }

    // H-04: Server-side cap on retry attempts — max 3 retries before auto-cancellation
    if (order.paymentRetryCount >= 3) {
      // Wrap cancellation in full transaction with stock restore, points reversal, coupon reversion
      await db.transaction(async (tx) => {
        // 1. Update order status
        await tx.update(orders)
          .set({ status: 'cancelled', cancelledAt: new Date() })
          .where(eq(orders.id, order.id));

        // 2. Write status history
        await tx.insert(orderStatusHistory).values({
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'cancelled',
          changedByType: 'system',
          note: 'Dibatalkan setelah 3 kali gagal pembayaran',
        });

        // 3. Restore stock (reserved at initiate)
        for (const item of order.items) {
          const [updated] = await tx
            .update(productVariants)
            .set({ stock: sql`stock + ${item.quantity}`, updatedAt: new Date() })
            .where(eq(productVariants.id, item.variantId))
            .returning({ newStock: productVariants.stock });

          if (updated) {
            await tx.insert(inventoryLogs).values({
              variantId: item.variantId,
              changeType: 'reversal',
              quantityBefore: updated.newStock - item.quantity,
              quantityAfter: updated.newStock,
              quantityDelta: item.quantity,
              orderId: order.id,
              note: `Pembatalan retry ${order.orderNumber} — stok dikembalikan`,
            });
          }
        }

        // 4. Reverse coupon if used
        if (order.couponId) {
          await tx.update(coupons)
            .set({ usedCount: sql`GREATEST(used_count - 1, 0)` })
            .where(eq(coupons.id, order.couponId));
          await tx.delete(couponUsages)
            .where(eq(couponUsages.orderId, order.id));
        }

        // 5. Reverse points if redeemed (FIFO unconsume)
        // H-04: STRESS TESTING NOTE — FIFO reversal fragility with concurrent redemptions:
        //
        // This reversal sets consumedAt: null on referenced earn records.
        // If a subsequent order has already consumed the same earn records (same earnId was
        // referenced by a newer redeem after this order's retry expired), the FIFO chain breaks.
        // The older earn record becomes "double-spent" — partially unconsumed while the newer
        // order already deducted its value from pointsBalance.
        //
        // Under high concurrency (multiple customers retrying at once with low points balance),
        // this can cause pointsBalance to go negative or redeem records to reference already-
        // consumed earnIds.
        //
        // Mitigation: pointsBalance uses GREATEST to prevent negative, but the FIFO chain
        // itself can be corrupted. A full stress test with 100+ concurrent retries is needed
        // to validate this edge case in production-like load.
        //
        // TODO: Consider adding a consumedAt version field or a lock table for earn records
        // to prevent concurrent consumption of the same earn record.
        if (order.userId && order.pointsUsed && order.pointsUsed > 0) {
          const redeemRecords = await tx
            .select()
            .from(pointsHistory)
            .where(and(
              eq(pointsHistory.userId, order.userId),
              eq(pointsHistory.type, 'redeem'),
              eq(pointsHistory.orderId, order.id)
            ));

          for (const redeem of redeemRecords) {
            if (redeem.referencedEarnId) {
              await tx.update(pointsHistory)
                .set({ consumedAt: null })
                .where(eq(pointsHistory.id, redeem.referencedEarnId));
            }
          }

          await tx.update(users)
            .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
            .where(eq(users.id, order.userId));
        }
      });

      return tooManyRequests('Pembayaran sudah mencapai batas retry. Pesanan dibatalkan.');
    }

    // Build item_details for Midtrans
    const itemDetails = order.items.map((item) => ({
      id: item.variantId,
      price: item.unitPrice,
      quantity: item.quantity,
      name: `${item.productNameId.substring(0, 45)} - ${item.variantNameId}`.substring(0, 50),
    }));

    if (order.shippingCost > 0) {
      itemDetails.push({
        id: 'shipping',
        price: order.shippingCost,
        quantity: 1,
        name: `Ongkir ${order.courierName ?? ''}`.substring(0, 50),
      });
    }

    if (order.discountAmount + order.pointsDiscount > 0) {
      itemDetails.push({
        id: 'discount',
        price: -(order.discountAmount + order.pointsDiscount),
        quantity: 1,
        name: 'Diskon & Poin',
      });
    }

    const expiryMinutes = await getSetting<number>('payment_expiry_minutes', 'integer') ?? 15;
    const retryCount = order.paymentRetryCount + 1;

    // Wrap Midtrans call + order update in transaction for atomicity
    const [updatedOrder] = await db.transaction(async (tx) => {
      // Create new Midtrans transaction
      const { snapToken, midtransOrderId } = await createMidtransTransaction({
        orderNumber,
        retryCount,
        grossAmount: order.totalAmount,
        customerName: order.recipientName,
        customerEmail: order.recipientEmail,
        customerPhone: order.recipientPhone,
        items: itemDetails,
      });

      // Update order with new Midtrans IDs and incremented retry count
      const [updated] = await tx
        .update(orders)
        .set({
          midtransOrderId,
          midtransSnapToken: snapToken,
          paymentRetryCount: retryCount,
          paymentExpiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
        })
        .where(and(
          eq(orders.id, order.id),
          eq(orders.status, 'pending_payment')
        ))
        .returning({ id: orders.id, midtransSnapToken: orders.midtransSnapToken });

      return [updated];
    });

    if (!updatedOrder) {
      return conflict('Order sudah tidak dapat diretry');
    }

    return success({
      orderId: order.id,
      orderNumber: order.orderNumber,
      snapToken: updatedOrder.midtransSnapToken,
      expiresAt: formatWIB(new Date(Date.now() + expiryMinutes * 60 * 1000)),
    });
  } catch (error) {
    logger.error('[checkout/retry]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}