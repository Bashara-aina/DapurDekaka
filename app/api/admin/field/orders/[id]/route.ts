import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderStatusHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, serverError, notFound, forbidden, conflict, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { z } from 'zod';

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
    console.error('[admin/field/orders/[id] GET]', error);
    return serverError(error);
  }
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  paid: ['processing'],
  processing: ['packed'],
  packed: ['shipped'],
  shipped: ['delivered'],
};

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

    const { status: newStatus, trackingNumber, trackingUrl, estimatedDays, note } = parsed.data;

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

    await db.update(orders).set(updateData).where(eq(orders.id, orderId));

    await db.insert(orderStatusHistory).values({
      orderId,
      fromStatus: currentStatus,
      toStatus: newStatus,
      changedByUserId: session.user.id,
      changedByType: 'user',
      note: note || `Status diubah oleh ${session.user.name} dari ${currentStatus} ke ${newStatus}`,
      metadata: trackingNumber ? { trackingNumber } : undefined,
    });

    return success({
      orderId,
      orderNumber: order.orderNumber,
      statusBefore: currentStatus,
      statusAfter: newStatus,
      shippedAt: newStatus === 'shipped' ? new Date() : null,
      deliveredAt: newStatus === 'delivered' ? new Date() : null,
    });
  } catch (error) {
    console.error('[admin/field/orders/[id] PATCH]', error);
    return serverError(error);
  }
}