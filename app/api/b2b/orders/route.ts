import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { success, unauthorized, forbidden } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Login diperlukan');
    if (session.user.role !== 'b2b') return forbidden('Akses ditolak');

    const userOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.userId, session.user.id),
        eq(orders.isB2b, true)
      ),
      with: { items: true },
      orderBy: [desc(orders.createdAt)],
    });

    return success(userOrders);
  } catch (error) {
    console.error('[b2b/orders GET]', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}