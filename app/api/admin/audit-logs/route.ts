import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { adminActivityLogs } from '@/lib/db/schema';
import { desc, eq, gte, lt, and, sql } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildConditions(params: URLSearchParams) {
  const conditions: ReturnType<typeof eq>[] = [];

  const action = params.get('action') ?? params.get('dateFrom_action') ?? '';
  const entityType = params.get('entityType') ?? '';
  const userId = params.get('userId') ?? '';
  const fromRaw = params.get('from') ?? params.get('dateFrom') ?? '';
  const toRaw = params.get('to') ?? params.get('dateTo') ?? '';

  if (action) conditions.push(eq(adminActivityLogs.action, action));
  if (entityType) conditions.push(eq(adminActivityLogs.entityType, entityType));
  if (userId) conditions.push(eq(adminActivityLogs.userId, userId));
  if (fromRaw) {
    const d = new Date(fromRaw);
    if (!isNaN(d.getTime())) conditions.push(gte(adminActivityLogs.createdAt, d));
  }
  if (toRaw) {
    const d = new Date(toRaw);
    if (!isNaN(d.getTime())) conditions.push(lt(adminActivityLogs.createdAt, d));
  }

  return conditions;
}

function buildWhere(conditions: ReturnType<typeof eq>[]) {
  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions);
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { searchParams } = new URL(req.url);
    const exportCsv = searchParams.get('export') === 'csv';

    const conditions = buildConditions(searchParams);
    const whereClause = buildWhere(conditions);

    if (exportCsv) {
      const logs = await db.query.adminActivityLogs.findMany({
        where: whereClause,
        with: {
          user: {
            columns: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: [desc(adminActivityLogs.createdAt)],
        limit: 5000,
      });

      const header = ['createdAt', 'action', 'entityType', 'entityId', 'userId', 'userEmail', 'summary'];
      const rows = logs.map((l) => {
        const afterSummary = l.afterState == null ? '' : JSON.stringify(l.afterState);
        const beforeSummary = l.beforeState == null ? '' : JSON.stringify(l.beforeState);
        return [
          l.createdAt,
          l.action,
          l.entityType,
          l.entityId ?? '',
          l.userId,
          l.user?.email ?? '',
          afterSummary || beforeSummary,
        ];
      });

      const csv = [header, ...rows]
        .map((cols) => cols.map(escapeCsv).join(','))
        .join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10));
    const page = Math.floor(offset / limit) + 1;

    const [logs, totalResult] = await Promise.all([
      db.query.adminActivityLogs.findMany({
        where: whereClause,
        with: {
          user: {
            columns: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: [desc(adminActivityLogs.createdAt)],
        limit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(adminActivityLogs)
        .where(whereClause)
        .execute()
        .then((r) => r[0]?.count ?? 0),
    ]);

    return success({
      logs,
      pagination: {
        page,
        limit,
        total: totalResult,
        totalPages: Math.ceil(totalResult / limit),
      },
    });
  } catch (error) {
    logger.error('[Admin Audit Logs GET]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}