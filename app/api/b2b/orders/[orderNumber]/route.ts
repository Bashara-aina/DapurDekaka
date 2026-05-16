import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { orders } from '@/lib/db/schema';
import { success, unauthorized, forbidden, notFound } from '@/lib/utils/api-response';

interface Props {
  params: Promise<{ orderNumber: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Login diperlukan');
    if (session.user.role !== 'b2b') return forbidden('Akses ditolak');

    const { orderNumber } = await params;

    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.userId, session.user.id),
        eq(orders.orderNumber, orderNumber),
        eq(orders.isB2b, true)
      ),
      with: {
        items: true,
        statusHistory: {
          orderBy: (history, { asc }) => [asc(history.createdAt)],
        },
      },
    });

    if (!order) return notFound('Pesanan tidak ditemukan');

    return success(order);
  } catch (error) {
    console.error('[b2b/orders/[orderNumber] GET]', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}