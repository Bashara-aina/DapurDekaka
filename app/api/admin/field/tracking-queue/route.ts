import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderStatusHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, serverError, notFound, forbidden, conflict, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { z } from 'zod';

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

    const packedOrders = await db.query.orders.findMany({
      where: eq(orders.status, 'packed'),
      with: {
        items: true,
        user: true,
      },
      orderBy: (orders, { asc }) => [asc(orders.createdAt)],
    });

    return success(packedOrders);
  } catch (error) {
    console.error('[admin/field/tracking-queue GET]', error);
    return serverError(error);
  }
}

const shipSchema = z.object({
  orderId: z.string().uuid(),
  trackingNumber: z.string().min(1, 'Nomor resi harus diisi'),
  trackingUrl: z.string().optional(),
  courierCode: z.string().optional(),
  courierName: z.string().optional(),
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

    const { orderId, trackingNumber, trackingUrl, courierCode, courierName, estimatedDays } = parsed.data;

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      return notFound('Order tidak ditemukan');
    }

    if (order.status !== 'packed') {
      return conflict('Hanya order dengan status packed yang dapat dikirim');
    }

    const updateData: Record<string, unknown> = {
      status: 'shipped',
      trackingNumber,
      shippedAt: new Date(),
      updatedAt: new Date(),
    };
    if (trackingUrl) updateData.trackingUrl = trackingUrl;
    if (courierCode) updateData.courierCode = courierCode;
    if (courierName) updateData.courierName = courierName;
    if (estimatedDays) updateData.estimatedDays = estimatedDays;

    await db.update(orders).set(updateData).where(eq(orders.id, orderId));

    await db.insert(orderStatusHistory).values({
      orderId,
      fromStatus: 'packed',
      toStatus: 'shipped',
      changedByUserId: session.user.id,
      changedByType: 'user',
      note: `Resi ${trackingNumber} ditambahkan, dikirim oleh ${session.user.name}`,
      metadata: { trackingNumber, courierCode, courierName },
    });

    return success({ orderId, status: 'shipped', trackingNumber });
  } catch (error) {
    console.error('[admin/field/tracking-queue PATCH]', error);
    return serverError(error);
  }
}