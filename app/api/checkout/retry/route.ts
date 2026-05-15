import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { orders } from '@/lib/db/schema';
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
      // Auto-cancel after 3 retries
      await db
        .update(orders)
        .set({ status: 'cancelled', cancelledAt: new Date() })
        .where(eq(orders.id, order.id));

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