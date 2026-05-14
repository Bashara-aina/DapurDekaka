import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { adminActivityLogs } from '@/lib/db/schema';
import { sql, desc, and, gte, eq } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (role !== 'superadmin') {
      return forbidden();
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const limit = 50;
    const offset = (page - 1) * limit;

    const logs = await db.query.adminActivityLogs.findMany({
      orderBy: [desc(adminActivityLogs.createdAt)],
      limit,
      offset,
    });

    const total = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminActivityLogs);

    return success({
      logs: logs.map(log => ({
        id: log.id,
        userId: log.userId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        createdAt: log.createdAt,
        ipAddress: log.ipAddress ? log.ipAddress.slice(-4).padStart(log.ipAddress.length, 'x') : null,
      })),
      total: total[0]?.count ?? 0,
      page,
      totalPages: Math.ceil((total[0]?.count ?? 0) / limit),
    });
  } catch (error) {
    console.error('[admin/audit-logs]', error);
    return serverError(error);
  }
}