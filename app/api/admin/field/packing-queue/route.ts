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

    const paidOrders = await db.query.orders.findMany({
      where: eq(orders.status, 'paid'),
      with: {
        items: true,
        user: true,
      },
      orderBy: (orders, { asc }) => [asc(orders.createdAt)],
    });

    const tierPriority = (tier: string | null): number => {
      if (tier === 'express') return 0;
      if (tier === 'frozen_same_day') return 1;
      if (tier === 'frozen_express') return 2;
      if (tier === 'pickup') return 3;
      return 4;
    };

    paidOrders.sort((a, b) => {
      const ta = tierPriority(a.shippingTier);
      const tb = tierPriority(b.shippingTier);
      if (ta !== tb) return ta - tb;
      return (a.paidAt?.getTime() ?? 0) - (b.paidAt?.getTime() ?? 0);
    });

    return success(paidOrders);
  } catch (error) {
    console.error('[admin/field/packing-queue GET]', error);
    return serverError(error);
  }
}

const packSchema = z.object({
  orderId: z.string().uuid(),
  note: z.string().optional(),
  coldChainCondition: z.string().optional(),
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

    const { orderId, note, coldChainCondition } = parsed.data;

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      return notFound('Order tidak ditemukan');
    }

    if (order.status !== 'paid') {
      return conflict('Hanya order dengan status paid yang dapat dipack');
    }

    await db
      .update(orders)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'paid')));

    await db.insert(orderStatusHistory).values({
      orderId,
      fromStatus: 'paid',
      toStatus: 'processing',
      changedByUserId: session.user.id,
      changedByType: 'user',
      note: `Auto-progressed by packing queue`,
    });

    const [packed] = await db
      .update(orders)
      .set({
        status: 'packed',
        updatedAt: new Date(),
        ...(order.deliveryMethod === 'delivery' ? { dispatchStatus: 'pending' as const } : {}),
      })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'processing')))
      .returning({ id: orders.id });

    if (!packed) {
      return conflict('Status order berubah saat packing — refresh dan coba lagi');
    }

    await db.insert(orderStatusHistory).values({
      orderId,
      fromStatus: 'processing',
      toStatus: 'packed',
      changedByUserId: session.user.id,
      changedByType: 'user',
      note: note
        ? `Order dikemas oleh ${session.user.name}: ${note}`
        : `Order dikemas oleh ${session.user.name}`,
      metadata: coldChainCondition ? { coldChainCondition } : undefined,
    });

    return success({ orderId, status: 'packed' });
  } catch (error) {
    console.error('[admin/field/packing-queue PATCH]', error);
    return serverError(error);
  }
}