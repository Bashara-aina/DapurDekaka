import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, serverError, notFound, forbidden, conflict } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderShippedEmail } from '@/lib/resend/templates/OrderShipped';
import { OrderDeliveredEmail } from '@/lib/resend/templates/OrderDelivered';
import { formatWIB } from '@/lib/utils/format-date';

const statusUpdateSchema = z.object({
  status: z.enum(['shipped', 'delivered']),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().optional(),
  estimatedDays: z.string().optional(),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  paid: ['processing'],
  processing: ['packed'],
  packed: ['shipped'],
  shipped: ['delivered'],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
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

    const { status: newStatus, trackingNumber, trackingUrl, estimatedDays } = parsed.data;

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { items: true },
    });

    if (!order) {
      return notFound('Order tidak ditemukan');
    }

    const currentStatus = order.status;
    const allowedTransitions = VALID_TRANSITIONS[currentStatus];

    if (!allowedTransitions?.includes(newStatus)) {
      return conflict(`Tidak dapat mengubah status dari ${currentStatus} ke ${newStatus}`);
    }

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
    }

    await db.update(orders).set(updateData).where(eq(orders.id, orderId));

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