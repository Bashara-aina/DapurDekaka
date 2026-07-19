import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderStatusHistory } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { success, serverError, notFound, forbidden, conflict, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderShippedEmail } from '@/lib/resend/templates/OrderShipped';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return forbidden('Anda tidak memiliki akses ke fitur ini');
    }

    const dispatchOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.status, 'packed'),
        eq(orders.deliveryMethod, 'delivery'),
        inArray(orders.dispatchStatus, ['pending', 'failed', 'retrying', 'booking']),
      ),
      with: {
        items: true,
        user: true,
      },
      orderBy: (orders, { asc }) => [asc(orders.createdAt)],
    });

    return success(dispatchOrders);
  } catch (error) {
    console.error('[admin/field/tracking-queue GET]', error);
    return serverError(error);
  }
}

const shipSchema = z.object({
  orderId: z.string().uuid(),
  trackingNumber: z.string().min(1, 'Nomor resi harus diisi'),
  trackingUrl: z.string().optional(),
  estimatedDays: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return forbidden('Anda tidak memiliki akses ke fitur ini');
    }

    const body = await req.json();
    const parsed = shipSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { orderId, trackingNumber, trackingUrl, estimatedDays } = parsed.data;

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { items: true },
    });

    if (!order) {
      return notFound('Order tidak ditemukan');
    }

    if (order.status !== 'packed') {
      return conflict('Hanya order dengan status packed yang dapat dikirim');
    }

    if (!order.items || order.items.length === 0) {
      return notFound('Item pesanan tidak ditemukan');
    }

    const updateData: Record<string, unknown> = {
      status: 'shipped',
      trackingNumber,
      shippedAt: new Date(),
      updatedAt: new Date(),
    };
    if (trackingUrl) updateData.trackingUrl = trackingUrl;
    if (estimatedDays) updateData.estimatedDays = estimatedDays;

    await db.update(orders).set(updateData).where(eq(orders.id, orderId));

    await db.insert(orderStatusHistory).values({
      orderId,
      fromStatus: 'packed',
      toStatus: 'shipped',
      changedByUserId: session.user.id,
      changedByType: 'user',
      note: `Resi ${trackingNumber} ditambahkan, dikirim oleh ${session.user.name}`,
      metadata: { trackingNumber },
    });

    // Fire-and-forget shipped email
    const COURIER_TRACKING_URLS: Record<string, string> = {
      SICEPAT: `https://www.sicepat.com/checkAwb?awb=${trackingNumber}`,
      JNE: `https://www.jne.co.id/id/tracking/trace/${trackingNumber}`,
      ANTERAJA: `https://anteraja.id/tracking/${trackingNumber}`,
    };
    const orderCourierCode = order.courierCode ?? '';
    const builtTrackingUrl = trackingUrl ??
      (orderCourierCode ? COURIER_TRACKING_URLS[orderCourierCode.toUpperCase()] ?? '' : '');

    await sendEmail({
      to: order.recipientEmail,
      subject: `Pesanan ${order.orderNumber} sudah dikirim!`,
      react: OrderShippedEmail({
        orderNumber: order.orderNumber,
        customerName: order.recipientName,
        courierName: order.courierName ?? 'Pengiriman',
        trackingNumber,
        trackingUrl: builtTrackingUrl,
        estimatedDays: estimatedDays ?? '',
        items: order.items?.map((item) => ({
          name: item.productNameId,
          variant: item.variantNameId,
          quantity: item.quantity,
        })) ?? [],
        totalAmount: order.totalAmount,
      }),
    }).catch(console.error);

    return success({ orderId, status: 'shipped', trackingNumber });
  } catch (error) {
    console.error('[admin/field/tracking-queue PATCH]', error);
    return serverError(error);
  }
}