import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth/check-role';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { disputes, orders } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { DisputesAdminClient } from './DisputesAdminClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('disputes');
  return { title: t('title') };
}

/**
 * Disputes admin (L2 Rule 7) — owners log complaints and the refund-first
 * stance captured per L1 dispute playbook. Server Component with client
 * island for status updates + new dispute form.
 */
export default async function DisputesPage() {
  const t = await getTranslations('disputes');
  await requireRole(['superadmin', 'owner']);

  const rows = await db
    .select({
      id: disputes.id,
      orderId: disputes.orderId,
      orderNumber: orders.orderNumber,
      category: disputes.category,
      customerMessage: disputes.customerMessage,
      ownerNotes: disputes.ownerNotes,
      status: disputes.status,
      createdAt: disputes.createdAt,
      resolvedAt: disputes.resolvedAt,
    })
    .from(disputes)
    .leftJoin(orders, eq(disputes.orderId, orders.id))
    .orderBy(desc(disputes.createdAt))
    .limit(100);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
      </header>
      <DisputesAdminClient initial={rows} />
    </div>
  );
}
