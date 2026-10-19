import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderStatusHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { success, serverError, notFound, forbidden, conflict, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { z } from 'zod';
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
    return serverError(error);
  }
}

const deliverSchema = z.object({
  orderId: z.string().uuid(),
  // W9: the handover code is mandatory server-side, not just a UI hint.
  pickupCode: z.string().min(4).max(20),
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

    const { orderId, pickupCode } = parsed.data;

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

    // W9: verify the customer's handover code before releasing the goods.
    if (!order.pickupCode || order.pickupCode.toUpperCase() !== pickupCode.trim().toUpperCase()) {
      return conflict('Kode ambil tidak cocok. Minta pelanggan menunjukkan kode yang benar.');
    }

    const [updated] = await db
      .update(orders)
      .set({ status: 'delivered', deliveredAt: new Date(), updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'packed')))
      .returning({ id: orders.id });

    if (!updated) {
      return conflict('Status order berubah — refresh dan coba lagi');
    }

    await db.insert(orderStatusHistory).values({
      orderId,
      fromStatus: 'packed',
      toStatus: 'delivered',
      changedByUserId: session.user.id,
      changedByType: 'user',
      note: `Order diambil oleh customer (kode terverifikasi), diproses oleh ${session.user.name}`,
    });

    return success({ orderId, status: 'delivered' });
  } catch (error) {
    return serverError(error);
  }
}