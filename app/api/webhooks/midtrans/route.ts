import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderItems, productVariants, inventoryLogs, coupons, pointsHistory, users } from '@/lib/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { success, serverError } from '@/lib/utils/api-response';
import { verifyMidtransSignature } from '@/lib/midtrans/verify-webhook';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderConfirmationEmail } from '@/lib/resend/templates/OrderConfirmation';
import { formatWIB } from '@/lib/utils/format-date';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
    } = body;

    // ── Step 1: Verify signature ────────────────────────────────────────
    const serverKey = process.env.MIDTRANS_SERVER_KEY!;
    const isValid = verifyMidtransSignature(
      order_id,
      status_code,
      gross_amount,
      serverKey,
      signature_key
    );

    if (!isValid) {
      console.warn('[Midtrans Webhook] Invalid signature', order_id);
      return NextResponse.json({ received: false }, { status: 400 });
    }

    // ── Step 2: Find order ───────────────────────────────────────────────
    const order = await db.query.orders.findFirst({
      where: eq(orders.midtransOrderId, order_id),
      with: { items: true },
    });

    if (!order) {
      console.warn('[Midtrans Webhook] Order not found', order_id);
      return NextResponse.json({ received: false }, { status: 404 });
    }

    // ── Step 3: Idempotency — already processed? ───────────────────────
    if (order.status === 'paid' && transaction_status === 'settlement') {
      return success({ received: true, note: 'already_processed' });
    }

    // ── Step 4: Settlement — full processing ───────────────────────────
    if (transaction_status === 'settlement') {
      await db.transaction(async (tx) => {
        // Update order status
        await tx
          .update(orders)
          .set({
            status: 'paid',
            paidAt: new Date(),
            midtransPaymentType: body.payment_type ?? null,
            midtransVaNumber: body.va_numbers?.[0]?.va_number ?? null,
          })
          .where(eq(orders.id, order.id));

        // Deduct stock (atomic, prevent negative)
        for (const item of order.items) {
          const result = await tx
            .update(productVariants)
            .set({
              stock: sql`GREATEST(stock - ${item.quantity}, 0)`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(productVariants.id, item.variantId),
                sql`stock >= ${item.quantity}`
              )
            )
            .returning({ newStock: productVariants.stock });

          const updatedStock = result[0];
          if (!updatedStock) {
            console.warn(`[Webhook] Stock deduction failed for variant ${item.variantId} — insufficient stock`);
            continue;
          }

          await tx.insert(inventoryLogs).values({
            variantId: item.variantId,
            changeType: 'sale',
            quantityBefore: updatedStock.newStock + item.quantity,
            quantityAfter: updatedStock.newStock,
            quantityDelta: -item.quantity,
            orderId: order.id,
          });
        }

        // Increment coupon used_count
        if (order.couponId) {
          await tx
            .update(coupons)
            .set({ usedCount: sql`used_count + 1` })
            .where(eq(coupons.id, order.couponId));
        }

        // Award loyalty points
        if (order.userId && order.pointsEarned > 0) {
          const updatedUsers = await tx
            .update(users)
            .set({ pointsBalance: sql`points_balance + ${order.pointsEarned}` })
            .where(eq(users.id, order.userId))
            .returning({ pointsBalance: users.pointsBalance });

          const newBalance = updatedUsers[0]?.pointsBalance ?? order.pointsEarned;

          await tx.insert(pointsHistory).values({
            userId: order.userId,
            type: 'earn',
            pointsAmount: order.pointsEarned,
            pointsBalanceAfter: newBalance,
            descriptionId: `Pembelian ${order.orderNumber}`,
            descriptionEn: `Purchase ${order.orderNumber}`,
            orderId: order.id,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          });
        }
      });

      console.log(`[Midtrans Webhook] Order ${order.orderNumber} paid successfully`);

      // ── Step 5: Send confirmation email (async, non-blocking) ─────────
      try {
        const emailHtml = OrderConfirmationEmail({
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
          deliveryMethod: order.deliveryMethod as 'delivery' | 'pickup',
          courierName: order.courierName ?? undefined,
          recipientName: order.recipientName,
          recipientPhone: order.recipientPhone,
          addressLine: order.addressLine ?? undefined,
          city: order.city ?? undefined,
          province: order.province ?? undefined,
          paidAt: formatWIB(new Date()),
        });

        await sendEmail({
          to: order.recipientEmail,
          subject: `Pesanan ${order.orderNumber} telah dikonfirmasi!`,
          react: emailHtml,
        });
      } catch (emailError) {
        // Non-critical — log but don't fail the webhook
        console.error('[Email] Failed to send confirmation:', emailError);
      }

    } else if (['cancel', 'deny', 'expire'].includes(transaction_status)) {
      // ── Step 6: Payment failed — reverse points + coupon ────────────────
      await db.transaction(async (tx) => {
        await tx
          .update(orders)
          .set({
            status: 'cancelled',
            cancelledAt: new Date(),
          })
          .where(eq(orders.id, order.id));

        // Reverse points if user had used them
        if (order.userId && order.pointsUsed > 0) {
          await tx
            .update(users)
            .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
            .where(eq(users.id, order.userId));
        }

        // Reverse coupon used_count (tentative increment should be undone)
        if (order.couponId) {
          await tx
            .update(coupons)
            .set({ usedCount: sql`GREATEST(used_count - 1, 0)` })
            .where(eq(coupons.id, order.couponId));
        }
      });

      console.log(`[Midtrans Webhook] Order ${order.orderNumber} cancelled: ${transaction_status}`);
    }

    return success({ received: true });
  } catch (error) {
    console.error('[Midtrans Webhook] Error:', error);
    return serverError(error);
  }
}