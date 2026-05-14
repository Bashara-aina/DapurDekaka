import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { adminActivityLogs, users } from '@/lib/db/schema';
import { desc, eq, gte, lt, and, sql } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

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
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
    const offset = (page - 1) * limit;
    const action = searchParams.get('action') ?? '';
    const entityType = searchParams.get('entityType') ?? '';
    const userId = searchParams.get('userId') ?? '';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const conditions: ReturnType<typeof eq>[] = [];

    if (action) {
      conditions.push(eq(adminActivityLogs.action, action));
    }
    if (entityType) {
      conditions.push(eq(adminActivityLogs.entityType, entityType));
    }
    if (userId) {
      conditions.push(eq(adminActivityLogs.userId, userId));
    }
    if (dateFrom) {
      conditions.push(gte(adminActivityLogs.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lt(adminActivityLogs.createdAt, new Date(dateTo)));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

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
        .then(r => r[0]?.count ?? 0),
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
    console.error('[Admin Audit Logs GET]', error);
    return serverError(error);
  }
}