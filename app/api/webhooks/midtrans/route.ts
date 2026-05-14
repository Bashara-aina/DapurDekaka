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
import { eq, and, inArray, sql, or } from 'drizzle-orm';
import crypto from 'crypto';
import { success, serverError } from '@/lib/utils/api-response';
import { verifyMidtransSignature } from '@/lib/midtrans/verify-webhook';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderConfirmationEmail } from '@/lib/resend/templates/OrderConfirmation';
import { OrderCancellationEmail } from '@/lib/resend/templates/OrderCancellation';
import { PickupInvitationEmail } from '@/lib/resend/templates/PickupInvitation';
import { formatWIB } from '@/lib/utils/format-date';
import { logger } from '@/lib/utils/logger';

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
      logger.warn('[Midtrans Webhook] Invalid signature', { orderId: order_id });
      return NextResponse.json({ received: false }, { status: 400 });
    }

    // ── Step 2: Find order ───────────────────────────────────────────────
    const order = await db.query.orders.findFirst({
      where: eq(orders.midtransOrderId, order_id),
      with: { items: true, user: true },
    });

    if (!order) {
      logger.warn('[Midtrans Webhook] Order not found', { orderId: order_id });
      return NextResponse.json({ received: false }, { status: 404 });
    }

    // ── Step 3: Idempotency — already processed? ───────────────────────
    if (order.status === 'paid' && transaction_status === 'settlement') {
      return success({ received: true, note: 'already_processed' });
    }

    // Cancellation idempotency — prevent double-processing if Midtrans sends multiple cancel/deny/expire webhooks
    if (order.status === 'cancelled' && ['cancel', 'deny', 'expire'].includes(transaction_status)) {
      return success({ received: true, note: 'already_cancelled' });
    }

    // ── Step 4: Settlement — full processing ───────────────────────────
    if (transaction_status === 'settlement') {
      // Amount cross-check — validate gross_amount matches order total to prevent tampered webhooks
      const expectedAmount = order.totalAmount;
      const webhookAmount = parseInt(gross_amount, 10);
      if (webhookAmount !== expectedAmount) {
        console.error('[Midtrans Webhook] Amount mismatch', {
          order_id,
          expectedAmount,
          webhookAmount,
        });
        return NextResponse.json({ received: false }, { status: 400 });
      }

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
            throw new Error(`Stock deduction failed for variant ${item.variantId} — insufficient stock`);
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

        // Award loyalty points (B2B users earn 2x)
        if (order.userId && order.pointsEarned > 0) {
          // Fetch user role to determine B2B multiplier
          const userRecord = await tx.query.users.findFirst({
            where: eq(users.id, order.userId),
            columns: { role: true },
          });
          const isB2B = userRecord?.role === 'b2b';
          const earnedPoints = isB2B ? order.pointsEarned * 2 : order.pointsEarned;

          const updatedUsers = await tx
            .update(users)
            .set({ pointsBalance: sql`points_balance + ${earnedPoints}` })
            .where(eq(users.id, order.userId))
            .returning({ pointsBalance: users.pointsBalance });

          const newBalance = updatedUsers[0]?.pointsBalance ?? earnedPoints;

          await tx.insert(pointsHistory).values({
            userId: order.userId,
            type: 'earn',
            pointsAmount: earnedPoints,
            pointsBalanceAfter: newBalance,
            descriptionId: `Pembelian ${order.orderNumber}${isB2B ? ' (Poin B2B 2x)' : ''}`,
            descriptionEn: `Purchase ${order.orderNumber}${isB2B ? ' (B2B Points 2x)' : ''}`,
            orderId: order.id,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          });
        }

        // Record order status history: pending_payment → paid
        await tx.insert(orderStatusHistory).values({
          orderId: order.id,
          fromStatus: 'pending_payment',
          toStatus: 'paid',
          changedByType: 'system',
          note: 'Pembayaran berhasil dikonfirmasi via Midtrans',
          metadata: {
            paymentType: body.payment_type ?? null,
            vaNumber: body.va_numbers?.[0]?.va_number ?? null,
            transactionId: body.transaction_id ?? null,
          },
        });

        // Record coupon usage
        if (order.couponId) {
          await tx.insert(couponUsages).values({
            couponId: order.couponId,
            orderId: order.id,
            userId: order.userId ?? null,
            discountApplied: order.discountAmount,
          });
        }
      });

      logger.info('[Midtrans Webhook] Order paid successfully', { orderNumber: order.orderNumber });

      // ── Step 5a: Send confirmation email (async, non-blocking) ─────────
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
        logger.error('[Email] Failed to send confirmation', { error: emailError instanceof Error ? emailError.message : String(emailError) });
      }

      // ── Step 5b: Send pickup invitation for pickup orders ────────────
      if (order.deliveryMethod === 'pickup') {
        try {
          const pickupEmailHtml = PickupInvitationEmail({
            orderNumber: order.orderNumber,
            customerName: order.recipientName,
            items: order.items.map((item) => ({
              name: item.productNameId,
              variant: item.variantNameId,
              quantity: item.quantity,
            })),
            totalAmount: order.totalAmount,
            pickupCode: order.orderNumber,
            paidAt: formatWIB(new Date()),
            pickupAddress: process.env.NEXT_PUBLIC_STORE_ADDRESS ?? 'Jl. Sinom V no. 7, Turangga, Bandung',
            openingHours: 'Senin-Sabtu: 08.00 - 17.00 WIB',
          });

          await sendEmail({
            to: order.recipientEmail,
            subject: `Pesanan ${order.orderNumber} siap diambil!`,
            react: pickupEmailHtml,
          });
        } catch (emailError) {
          logger.error('[Email] Failed to send pickup invitation', { error: emailError instanceof Error ? emailError.message : String(emailError) });
        }
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

        // Reverse points if user had used them (FIFO: unconsume referenced earn records)
        if (order.userId && order.pointsUsed > 0) {
          // Find redeem records for this order that were created at initiate time
          // These have referencedEarnId and consumedAt set
          const redeemRecords = await tx
            .select()
            .from(pointsHistory)
            .where(
              and(
                eq(pointsHistory.userId, order.userId),
                eq(pointsHistory.type, 'redeem'),
                sql`${pointsHistory.referencedEarnId} IS NOT NULL`
              )
            )
            .orderBy(pointsHistory.createdAt)
            .limit(order.pointsUsed);

          // Unconsume the referenced earn records
          for (const redeem of redeemRecords) {
            if (redeem.referencedEarnId) {
              await tx
                .update(pointsHistory)
                .set({ consumedAt: null })
                .where(eq(pointsHistory.id, redeem.referencedEarnId));
            }
          }

          // Restore points balance
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

      logger.info('[Midtrans Webhook] Order cancelled', { orderNumber: order.orderNumber, reason: transaction_status });

      // ── Step 7: Send cancellation email ─────────────────────────────
      try {
        const cancelReason = transaction_status === 'expire'
          ? 'Pembayaran kadaluarsa (maksimal waktu pembayaran terlampaui)'
          : transaction_status === 'cancel'
            ? 'Pembayaran dibatalkan oleh sistem Midtrans'
            : 'Pembayaran ditolak oleh bank atau provider';

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
          reason: cancelReason,
          cancelledAt: formatWIB(new Date()),
          refundAmount: order.totalAmount,
          refundInfo: 'Pengembalian dana akan diproses 1-7 hari kerja',
        });

        await sendEmail({
          to: order.recipientEmail,
          subject: `Pesanan ${order.orderNumber} dibatalkan`,
          react: cancellationEmailHtml,
        });
      } catch (emailError) {
        logger.error('[Email] Failed to send cancellation email', { error: emailError instanceof Error ? emailError.message : String(emailError) });
      }
    }

    return success({ received: true });
  } catch (error) {
    logger.error('[Midtrans Webhook] Error', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}