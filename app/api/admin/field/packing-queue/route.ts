import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderStatusHistory } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
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

    const paidOrders = await db.query.orders.findMany({
      where: eq(orders.status, 'paid'),
      with: {
        items: true,
        user: true,
      },
      orderBy: (orders, { asc }) => [asc(orders.createdAt)],
    });

    return success(paidOrders);
  } catch (error) {
    console.error('[admin/field/packing-queue GET]', error);
    return serverError(error);
  }
}

const packSchema = z.object({
  orderId: z.string().uuid(),
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
    const parsed = packSchema.safeParse(body);
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

    if (order.status !== 'paid') {
      return conflict('Hanya order dengan status paid yang dapat dipack');
    }

    await db.transaction(async (tx) => {
      // First: paid → processing
      await tx.update(orders)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), eq(orders.status, 'paid')));

      await tx.insert(orderStatusHistory).values({
        orderId,
        fromStatus: 'paid',
        toStatus: 'processing',
        changedByUserId: session.user.id,
        changedByType: 'user',
        note: `Auto-progressed by packing queue`,
      });

      // Then: processing → packed
      await tx.update(orders)
        .set({ status: 'packed', packedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), eq(orders.status, 'processing')));

      await tx.insert(orderStatusHistory).values({
        orderId,
        fromStatus: 'processing',
        toStatus: 'packed',
        changedByUserId: session.user.id,
        changedByType: 'user',
        note: `Order dikemas oleh ${session.user.name}`,
      });
    });

    return success({ orderId, status: 'packed' });
  } catch (error) {
    console.error('[admin/field/packing-queue PATCH]', error);
    return serverError(error);
  }
}