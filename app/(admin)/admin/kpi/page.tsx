import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { orders, refunds } from '@/lib/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import { formatIDR } from '@/lib/utils/format-currency';

export const dynamic = 'force-dynamic';

const ONE_WEEK_AGO = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const ONE_MONTH_AGO = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

interface KpiRow {
  value: number;
}

export default async function KpiPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!['superadmin', 'owner'].includes(session.user.role)) redirect('/admin');

  const t = await getTranslations('kpi');

  const [wkRows, moRows, refundRows, paidMRows] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.status, 'paid'), gte(orders.createdAt, ONE_WEEK_AGO()))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.status, 'paid'), gte(orders.createdAt, ONE_MONTH_AGO()))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(refunds)
      .where(and(gte(refunds.createdAt, ONE_MONTH_AGO()))),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.status, 'paid'), gte(orders.createdAt, ONE_MONTH_AGO()))),
  ]);

  const wk: KpiRow = wkRows[0] ?? { value: 0 };
  const mo: KpiRow = moRows[0] ?? { value: 0 };
  const refund: KpiRow = refundRows[0] ?? { value: 0 };
  const paidM: KpiRow = paidMRows[0] ?? { value: 0 };

  const refundRate = paidM.value === 0 ? 0 : (refund.value / paidM.value) * 100;

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold text-text-primary">{t('title')}</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-muted uppercase">{t('ordersThisWeek')}</p>
            <p className="text-2xl font-bold text-text-primary mt-1">{wk.value}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-muted uppercase">{t('ordersThisMonth')}</p>
            <p className="text-2xl font-bold text-text-primary mt-1">{mo.value}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-muted uppercase">{t('refundRate')}</p>
            <p className={refundRate <= 2 ? 'text-2xl font-bold text-green-600 mt-1' : 'text-2xl font-bold text-amber-600 mt-1'}>
              {refundRate.toFixed(1)}%
            </p>
            <p className="text-xs text-text-muted">≤ 2% target</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-text-muted uppercase">{t('targetWeek12')}</p>
            <p className="text-2xl font-bold text-text-primary mt-1">300 / bln</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-semibold text-text-primary">{t('phase1Status')}</p>
          <p className="text-xs text-text-muted">
            {mo.value < 50 ? t('phaseCriteriaNotMet') : t('phaseCriteriaMet')} ({mo.value} paid order bulan ini)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}