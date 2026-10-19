import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderStatusHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, serverError, notFound, forbidden, conflict, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { sendEmail } from '@/lib/resend/send-email';
import { OrderShippedEmail } from '@/lib/resend/templates/OrderShipped';
import { sendPickupReadyNotification } from '@/lib/services/pickup-ready';
import { logger } from '@/lib/utils/logger';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return forbidden('Anda tidak memiliki akses ke fitur ini');
    }

    const { id } = await params;

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        items: true,
        user: true,
        statusHistory: {
          orderBy: (h, { desc }) => [desc(h.createdAt)],
        },
      },
    });

    if (!order) {
      return notFound('Order tidak ditemukan');
    }

    return success(order);
  } catch (error) {
    return serverError(error);
  }
}

import { ORDER_TRANSITIONS } from '@/lib/constants/orders';

// W5/W10: both field and admin routes share the same transition map; pickup
// orders go packed → delivered, delivery goes packed → shipped.
function allowedTransitionsFor(
  deliveryMethod: string,
  currentStatus: string
): readonly string[] {
  const machine = deliveryMethod === 'pickup' ? ORDER_TRANSITIONS.pickup : ORDER_TRANSITIONS.delivery;
  return machine[currentStatus] ?? [];
}

// Warehouse can progress an order but never cancel/refund/refund-deliver.
const WAREHOUSE_RESTRICTED_TRANSITIONS: Record<string, string[]> = {
  paid: ['processing'],
  processing: ['packed'],
  packed: ['shipped', 'delivered'],
};

const statusUpdateSchema = z.object({
  status: z.enum(['processing', 'packed', 'shipped', 'delivered']),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().optional(),
  estimatedDays: z.string().optional(),
  note: z.string().optional(),
  // W9: required (and verified) when delivering a pickup order.
  pickupCode: z.string().optional(),
});

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
    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return forbidden('Anda tidak memiliki akses ke fitur ini');
    }

    const body = await req.json();
    const parsed = statusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { status: newStatus, trackingNumber, trackingUrl, estimatedDays, note, pickupCode } = parsed.data;

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { items: true },
    });

    if (!order) {
      return notFound('Order tidak ditemukan');
    }

    const currentStatus = order.status;
    const allowedTransitions = allowedTransitionsFor(order.deliveryMethod, currentStatus);

    if (!allowedTransitions.includes(newStatus)) {
      return conflict(`Tidak dapat mengubah status dari ${currentStatus} ke ${newStatus}`);
    }

    // Manual packed→shipped bypasses Biteship — only allow it as an explicit
    // fallback when the order never went through the dispatch flow.
    if (
      newStatus === 'shipped' &&
      order.deliveryMethod === 'delivery' &&
      !order.biteshipOrderId &&
      !trackingNumber
    ) {
      return conflict('Gunakan "Book courier" atau isi nomor resi untuk pengiriman manual');
    }

    // W9: never release a pickup order without the customer's handover code.
    if (newStatus === 'delivered' && order.deliveryMethod === 'pickup') {
      if (
        !order.pickupCode ||
        !pickupCode ||
        order.pickupCode.toUpperCase() !== pickupCode.trim().toUpperCase()
      ) {
        return conflict('Kode ambil tidak cocok. Minta pelanggan menunjukkan kode yang benar.');
      }
    }

    if (role === 'warehouse') {
      const warehouseAllowed = WAREHOUSE_RESTRICTED_TRANSITIONS[currentStatus];
      if (!warehouseAllowed?.includes(newStatus)) {
        return forbidden('Warehouse role hanya dapat mengubah status packed ke shipped');
      }
    }

    // Tracking number not required for pickup orders
    if (newStatus === 'shipped' && !trackingNumber && order.deliveryMethod !== 'pickup') {
      return NextResponse.json(
        {
          success: false,
          error: 'Nomor resi harus diisi untuk status shipped',
          code: 'VALIDATION_ERROR',
          details: { trackingNumber: ['Nomor resi harus diisi untuk status shipped'] },
        },
        { status: 422 }
      );
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

    await db.transaction(async (tx) => {
      await tx.update(orders).set(updateData).where(eq(orders.id, orderId));

      await tx.insert(orderStatusHistory).values({
        orderId,
        fromStatus: currentStatus,
        toStatus: newStatus,
        changedByUserId: session.user.id,
        changedByType: 'user',
        note: note || `Status diubah oleh ${session.user.name} dari ${currentStatus} ke ${newStatus}`,
        metadata: trackingNumber ? { trackingNumber } : undefined,
      });
    });

    // W11: pickup ready notification when the order is packed.
    if (newStatus === 'packed' && order.deliveryMethod === 'pickup') {
      await sendPickupReadyNotification(order);
    }

    // Send shipped email notification (skip when Biteship already sent one).
    if (newStatus === 'shipped' && trackingNumber && !order.biteshipOrderId) {
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
        logger.warn('[Field Order] Failed to send shipped email:', { error: emailError instanceof Error ? emailError.message : String(emailError) });
      }
    }

    return success({
      orderId,
      orderNumber: order.orderNumber,
      statusBefore: currentStatus,
      statusAfter: newStatus,
      shippedAt: newStatus === 'shipped' ? new Date() : null,
      deliveredAt: newStatus === 'delivered' ? new Date() : null,
    });
  } catch (error) {
    return serverError(error);
  }
}