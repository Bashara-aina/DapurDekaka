import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  orders,
  orderItems,
  orderStatusHistory,
  productVariants,
  inventoryLogs,
  coupons,
  pointsHistory,
  users,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { success, serverError } from '@/lib/utils/api-response';
import { verifyMidtransSignature } from '@/lib/midtrans/verify-webhook';
import { earnPoints } from '@/lib/services/points.service';
import { sendOrderConfirmationEmail } from '@/lib/services/notification.service';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { received: false, error: 'Invalid JSON' },
      { status: 400, headers: corsHeaders }
    );
  }

  const {
    order_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status,
    payment_type,
    fraud_status,
  } = body as Record<string, string | undefined>;

  if (!order_id || !status_code || !gross_amount || !signature_key) {
    return NextResponse.json(
      { received: false, error: 'Missing required fields' },
      { status: 400, headers: corsHeaders }
    );
  }

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
    return NextResponse.json(
      { received: false, error: 'Invalid signature' },
      { status: 400, headers: corsHeaders }
    );
  }

  const order = await db.query.orders.findFirst({
    where: eq(orders.midtransOrderId, order_id),
    with: { items: true },
  });

  if (!order) {
    console.warn('[Midtrans Webhook] Order not found', order_id);
    return NextResponse.json(
      { received: false, error: 'Order not found' },
      { status: 404, headers: corsHeaders }
    );
  }

  // Idempotency — skip if already settled
  if (order.status === 'paid' && transaction_status === 'settlement') {
    return NextResponse.json(
      { received: true, note: 'already_processed' },
      { headers: corsHeaders }
    );
  }

  const isSettled =
    transaction_status === 'settlement' ||
    (transaction_status === 'capture' && fraud_status === 'accept');

  const isFailed =
    transaction_status === 'cancel' ||
    transaction_status === 'deny' ||
    transaction_status === 'expire';

  if (isSettled) {
    await db.transaction(async (tx) => {
        await tx
          .update(orders)
          .set({
            status: 'paid',
            paidAt: new Date(),
            midtransPaymentType: payment_type ?? null,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));

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
          console.warn(
            `[Webhook] Stock deduction failed for variant ${item.variantId}`
          );
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

      if (order.couponId) {
        await tx
          .update(coupons)
          .set({ usedCount: sql`used_count + 1` })
          .where(eq(coupons.id, order.couponId));
      }

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: 'pending_payment',
        toStatus: 'paid',
        changedByType: 'system',
        note: `Pembayaran berhasil via ${payment_type ?? 'midtrans'}`,
      });
    });

    console.log(`[Midtrans] Order ${order.orderNumber} paid successfully`);

    if (order.userId && order.pointsEarned && order.pointsEarned > 0) {
      earnPoints(order.userId, order.id, order.subtotal).catch((e) =>
        console.error('[Webhook] Points earn failed:', e)
      );
    }

    sendOrderConfirmationEmail(order.id).catch((e) =>
      console.error('[Webhook] Email failed:', e)
    );

    return NextResponse.json(
      { received: true },
      { headers: corsHeaders }
    );
  }

  if (isFailed) {
    if (order.status !== 'pending_payment') {
      return NextResponse.json(
        { received: true, note: 'already_processed' },
        { headers: corsHeaders }
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      if (order.userId && order.pointsUsed && order.pointsUsed > 0) {
        await tx
          .update(users)
          .set({ pointsBalance: sql`points_balance + ${order.pointsUsed}` })
          .where(eq(users.id, order.userId));

        const [updatedUser] = await tx
          .select({ pointsBalance: users.pointsBalance })
          .from(users)
          .where(eq(users.id, order.userId))
          .limit(1);

        await tx.insert(pointsHistory).values({
          userId: order.userId,
          orderId: order.id,
          type: 'adjust',
          pointsAmount: order.pointsUsed,
          pointsBalanceAfter:
            updatedUser?.pointsBalance ?? order.pointsUsed,
          descriptionId: 'Pengembalian poin karena pembayaran gagal',
          descriptionEn: 'Points refunded due to failed payment',
        });
      }

      if (order.couponId) {
        await tx
          .update(coupons)
          .set({ usedCount: sql`GREATEST(used_count - 1, 0)` })
          .where(eq(coupons.id, order.couponId));
      }

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: 'pending_payment',
        toStatus: 'cancelled',
        changedByType: 'system',
        note: `Pembayaran gagal: ${transaction_status}`,
      });
    });

    console.log(
      `[Midtrans] Order ${order.orderNumber} cancelled: ${transaction_status}`
    );

    return NextResponse.json(
      { received: true },
      { headers: corsHeaders }
    );
  }

  return NextResponse.json(
    { received: true, note: 'unhandled_status' },
    { headers: corsHeaders }
  );
}
