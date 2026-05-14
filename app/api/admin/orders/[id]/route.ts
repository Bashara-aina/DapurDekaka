import { NextRequest } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { success, notFound, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderItems, orderStatusHistory } from '@/lib/db/schema';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { id } = await params;

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        items: true,
        user: {
          columns: { id: true, name: true, email: true, phone: true },
        },
        statusHistory: {
          orderBy: [desc(orderStatusHistory.createdAt)],
        },
      },
    });

    if (!order) {
      return notFound('Order tidak ditemukan');
    }

    return success(order);
  } catch (error) {
    console.error('[Admin Orders GET id]', error);
    return serverError(error);
  }
}