import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { orders, refunds, webhookEvents } from '@/lib/db/schema';
import { and, eq, gte, sql, lte, desc, count } from 'drizzle-orm';
import { OpsChecklist } from './OpsChecklist';

export const dynamic = 'force-dynamic';

const ONE_HOUR_AGO = () => new Date(Date.now() - 60 * 60 * 1000);
const TWENTY_FOUR_HOURS_AGO = () => new Date(Date.now() - 24 * 60 * 60 * 1000);
const THREE_DAYS_AGO = () => new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
const SEVEN_DAYS_AGO = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

interface CountRow { value: number; }
interface TotalRow { total: number; }

/**
 * Daily Ops Card (L4) — 15-minute morning checklist.
 */
export default async function OpsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!['superadmin', 'owner'].includes(session.user.role)) redirect('/admin');

  const t = await getTranslations('opsCard');

  const [webhookErrRows, pendingOldRows, paidNotPackedRows, refundsOverdueRows, weeklyGrossRows, recentRefunds] = await Promise.all([
    db
      .select({ value: count() })
      .from(webhookEvents)
      .where(and(gte(webhookEvents.createdAt, TWENTY_FOUR_HOURS_AGO()), sql`${webhookEvents.errorMessage} IS NOT NULL`)),
    db
      .select({ value: count() })
      .from(orders)
      .where(and(eq(orders.status, 'pending_payment'), lte(orders.createdAt, ONE_HOUR_AGO()))),
    db
      .select({ value: count() })
      .from(orders)
      .where(and(eq(orders.status, 'paid'), eq(orders.dispatchStatus, 'pending'))),
    db
      .select({ value: count() })
      .from(refunds)
      .where(and(eq(refunds.status, 'pending'), gte(refunds.createdAt, THREE_DAYS_AGO()))),
    db
      .select({ total: sql<number>`COALESCE(SUM(${orders.totalAmount}),0)::int` })
      .from(orders)
      .where(and(eq(orders.status, 'paid'), gte(orders.createdAt, SEVEN_DAYS_AGO()))),
    db.query.refunds.findMany({
      orderBy: [desc(refunds.createdAt)],
      limit: 5,
    }),
  ]);

  const webhookErrRow: CountRow = webhookErrRows[0] ?? { value: 0 };
  const pendingOldRow: CountRow = pendingOldRows[0] ?? { value: 0 };
  const paidNotPackedRow: CountRow = paidNotPackedRows[0] ?? { value: 0 };
  const refundsOverdueRow: CountRow = refundsOverdueRows[0] ?? { value: 0 };
  const weeklyGrossRow: TotalRow = weeklyGrossRows[0] ?? { total: 0 };

  const data = {
    webhookErrorCount24h: webhookErrRow.value,
    pendingOrdersOver1h: pendingOldRow.value,
    paidNotPacked: paidNotPackedRow.value,
    refundsOverdue3d: refundsOverdueRow.value,
    weeklyGrossIdr: weeklyGrossRow.total,
    recentRefunds,
  };

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
        <p className="text-sm text-text-muted mt-1">{t('subtitle')}</p>
      </header>
      <OpsChecklist data={data} />
      <p className="text-xs text-text-muted italic">{t('weeklyHint')}</p>
    </div>
  );
}