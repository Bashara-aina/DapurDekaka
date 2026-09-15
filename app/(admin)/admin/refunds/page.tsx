import { requireRole } from '@/lib/auth/check-role';
import { db } from '@/lib/db';
import { refunds, orders, users } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import RefundsClient from './RefundsClient';

export const dynamic = 'force-dynamic';

export default async function RefundsPage() {
  await requireRole(['superadmin', 'owner']);

  const rows = await db
    .select({
      id: refunds.id,
      orderId: refunds.orderId,
      orderNumber: orders.orderNumber,
      amount: refunds.amount,
      reason: refunds.reason,
      method: refunds.method,
      status: refunds.status,
      notes: refunds.notes,
      initiatedBy: refunds.initiatedBy,
      initiatorName: users.name,
      initiatorEmail: users.email,
      processedAt: refunds.processedAt,
      createdAt: refunds.createdAt,
      updatedAt: refunds.updatedAt,
    })
    .from(refunds)
    .leftJoin(orders, eq(refunds.orderId, orders.id))
    .leftJoin(users, eq(refunds.initiatedBy, users.id))
    .orderBy(desc(refunds.createdAt))
    .limit(200);

  return <RefundsClient initialRows={rows} />;
}