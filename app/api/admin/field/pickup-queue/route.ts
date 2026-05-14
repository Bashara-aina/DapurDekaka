import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderStatusHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
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

    const pickupOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.deliveryMethod, 'pickup'),
        eq(orders.status, 'packed')
      ),
      with: {
        items: true,
        user: true,
      },
      orderBy: (orders, { asc }) => [asc(orders.createdAt)],
    });

    return success(pickupOrders);
  } catch (error) {
    console.error('[admin/field/pickup-queue GET]', error);
    return serverError(error);
  }
}

const deliverSchema = z.object({
  orderId: z.string().uuid(),
  pickupCode: z.string().optional(),
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
    const parsed = deliverSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { orderId } = parsed.data;

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      return notFound('Order tidak ditemukan');
    }

    if (order.status !== 'packed') {
      return conflict('Hanya order dengan status packed yang dapat diambil');
    }

    if (order.deliveryMethod !== 'pickup') {
      return conflict('Order ini bukan metode pickup');
    }

    await db.update(orders).set({ status: 'delivered', deliveredAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, orderId));

    await db.insert(orderStatusHistory).values({
      orderId,
      fromStatus: 'packed',
      toStatus: 'delivered',
      changedByUserId: session.user.id,
      changedByType: 'user',
      note: `Order diambil oleh customer, diproses oleh ${session.user.name}`,
    });

    return success({ orderId, status: 'delivered' });
  } catch (error) {
    console.error('[admin/field/pickup-queue PATCH]', error);
    return serverError(error);
  }
}