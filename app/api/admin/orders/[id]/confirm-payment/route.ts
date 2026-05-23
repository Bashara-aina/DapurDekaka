import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  orders,
  orderItems,
  productVariants,
  inventoryLogs,
  coupons,
  couponUsages,
  pointsHistory,
  users,
  orderStatusHistory,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { success, notFound, forbidden, serverError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderConfirmationEmail } from '@/lib/resend/templates/OrderConfirmation';
import { logger } from '@/lib/utils/logger';
import { POINTS_EXPIRY_DAYS } from '@/lib/constants/points';
import { formatWIB } from '@/lib/utils/format-date';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/orders/[id]/confirm-payment
 *
 * Confirms payment for B2B Net-30 orders where points were NOT awarded at creation
 * (because Net-30 skips Midtrans). Only superadmin/owner can call this.
 *
 * Awards loyalty points, records order status history, sends confirmation email.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { id: orderId } = await params;

    // Fetch order with items
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { items: true },
    });

    if (!order) {
      return notFound('Pesanan tidak ditemukan');
    }

    // Only allow for Net-30 B2B orders that are already 'paid' (no Midtrans involved)
    if (order.paymentMethod !== 'net30') {
      return NextResponse.json(
        { success: false, error: 'Hanya pesanan Net-30 B2B yang dapat dikonfirmasi', code: 'INVALID_ORDER_TYPE' },
        { status: 400 }
      );
    }

    if (!order.isB2b) {
      return NextResponse.json(
        { success: false, error: 'Hanya pesanan B2B yang dapat dikonfirmasi', code: 'INVALID_ORDER_TYPE' },
        { status: 400 }
      );
    }

    // Check if points were already awarded for this order
    const existingEarnRecord = await db.query.pointsHistory.findFirst({
      where: and(
        eq(pointsHistory.orderId, orderId),
        eq(pointsHistory.type, 'earn')
      ),
    });

    if (existingEarnRecord) {
      return NextResponse.json(
        { success: false, error: 'Poin sudah diberikan untuk pesanan ini', code: 'POINTS_ALREADY_AWARDED' },
        { status: 409 }
      );
    }

    if (!order.userId || order.pointsEarned <= 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada poin untuk diberikan', code: 'NO_POINTS_TO_AWARD' },
        { status: 400 }
      );
    }

    // Award points in a transaction
    const userId = order.userId as string; // already checked above
    await db.transaction(async (tx) => {
      // Award loyalty points (B2B 2x multiplier already included in pointsEarned)
      const earnedPoints = order.pointsEarned;

      const [updatedUser] = await tx
        .update(users)
        .set({ pointsBalance: sql`points_balance + ${earnedPoints}` })
        .where(eq(users.id, userId))
        .returning({ pointsBalance: users.pointsBalance });

      const newBalance = updatedUser?.pointsBalance ?? earnedPoints;

      await tx.insert(pointsHistory).values({
        userId: userId,
        type: 'earn',
        pointsAmount: earnedPoints,
        pointsBalanceAfter: newBalance,
        descriptionId: `Pembelian B2B ${order.orderNumber} (Net-30 — konfirmasi manual)`,
        descriptionEn: `B2B purchase ${order.orderNumber} (Net-30 — manual confirm)`,
        orderId: order.id,
        expiresAt: new Date(Date.now() + POINTS_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      });

      // Record order status history: paid (Net-30 confirmed)
      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: 'paid',
        toStatus: 'paid',
        changedByType: 'admin',
        changedByUserId: session.user.id,
        note: `Pembayaran Net-30 B2B dikonfirmasi secara manual oleh admin. Poin diberikan.`,
      });

      // Confirm coupon usage if applicable
      if (order.couponId) {
        const existingUsage = await tx
          .select({ id: couponUsages.id })
          .from(couponUsages)
          .where(and(
            eq(couponUsages.couponId, order.couponId),
            eq(couponUsages.orderId, order.id)
          ));

        if (existingUsage.length === 0) {
          await tx
            .update(coupons)
            .set({ usedCount: sql`used_count + 1` })
            .where(eq(coupons.id, order.couponId));

          await tx
            .insert(couponUsages)
            .values({
              couponId: order.couponId,
              orderId: order.id,
              userId: userId,
              discountApplied: order.discountAmount,
            });
        }
      }
    });

    // Send confirmation email (non-blocking)
    sendEmail({
      to: order.recipientEmail,
      subject: `Pesanan ${order.orderNumber} telah dikonfirmasi!`,
      react: OrderConfirmationEmail({
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
        shippingCost: order.shippingCost ?? 0,
        discountAmount: order.discountAmount ?? 0,
        totalAmount: order.totalAmount,
        deliveryMethod: order.deliveryMethod as 'delivery' | 'pickup',
        courierName: order.courierName ?? undefined,
        recipientName: order.recipientName,
        recipientPhone: order.recipientPhone ?? '',
        addressLine: order.addressLine ?? undefined,
        city: order.city ?? undefined,
        province: order.province ?? undefined,
        paidAt: formatWIB(order.paidAt ?? new Date()),
      }),
    }).catch((emailError) => {
      logger.error('[Confirm Payment] Failed to send confirmation email', {
        orderNumber: order.orderNumber,
        error: emailError instanceof Error ? emailError.message : String(emailError),
      });
    });

    logger.info('[Confirm Payment] Net-30 B2B order payment confirmed', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      pointsEarned: order.pointsEarned,
      confirmedBy: session.user.id,
    });

    return success({
      orderId: order.id,
      orderNumber: order.orderNumber,
      pointsAwarded: order.pointsEarned,
    });
  } catch (error) {
    console.error('[Admin Orders Confirm Payment POST]', error);
    return serverError(error);
  }
}