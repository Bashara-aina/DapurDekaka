import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq, and, sql } from 'drizzle-orm';
import { orders, orderItems, productVariants, inventoryLogs, coupons, couponUsages, pointsHistory, users, orderStatusHistory } from '@/lib/db/schema';
import { success, serverError, notFound, conflict, unauthorized, forbidden } from '@/lib/utils/api-response';
import { createMidtransTransaction } from '@/lib/midtrans/create-transaction';
import { formatWIB } from '@/lib/utils/format-date';
import { getSetting } from '@/lib/settings/get-settings';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { orderNumber } = body;

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: 'orderNumber diperlukan', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

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

    if (order.paymentRetryCount >= 3) {
      // BUG-04: Wrap cancellation in full transaction with stock restore, points reversal, coupon reversion
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

      return conflict('Pembayaran sudah mencapai batas retry. Pesanan dibatalkan.');
    }

    const retryCount = order.paymentRetryCount + 1;
    const newMidtransOrderId = `${orderNumber}-retry-${retryCount}`;

    // Build item_details
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

    // Update order with new Midtrans IDs
    const expiryMinutes = await getSetting<number>('payment_expiry_minutes', 'integer') ?? 15;
    await db
      .update(orders)
      .set({
        midtransOrderId,
        midtransSnapToken: snapToken,
        paymentRetryCount: retryCount,
        paymentExpiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
      })
      .where(eq(orders.id, order.id));

    return success({
      orderId: order.id,
      orderNumber: order.orderNumber,
      snapToken,
      expiresAt: formatWIB(new Date(Date.now() + expiryMinutes * 60 * 1000)),
    });
  } catch (error) {
    console.error('[checkout/retry]', error);
    return serverError(error);
  }
}