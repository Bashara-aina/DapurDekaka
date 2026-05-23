import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return forbidden('Akses ditolak');

    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') return forbidden('Anda tidak memiliki akses');

    const [pending_payment, paid, processing, packed, shipped] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, 'pending_payment')),
      db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, 'paid')),
      db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, 'processing')),
      db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, 'packed')),
      db.select({ count: sql<number>`count(*)::int` }).from(orders).where(eq(orders.status, 'shipped')),
    ]);

    return success({
      pending_payment: pending_payment[0]?.count ?? 0,
      paid: paid[0]?.count ?? 0,
      processing: processing[0]?.count ?? 0,
      packed: packed[0]?.count ?? 0,
      shipped: shipped[0]?.count ?? 0,
    });
  } catch (error) {
    console.error('[admin/team-dashboard/order-pipeline]', error);
    return serverError(error);
  }
}