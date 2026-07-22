import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, like, or, desc, sql, and } from 'drizzle-orm';
import { success, forbidden, serverError, unauthorized } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/utils/rate-limit';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withRateLimit(async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');
    if (!['superadmin', 'owner'].includes(session.user.role ?? '')) return forbidden('Akses ditolak');

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') ?? '';
    const roleFilter = searchParams.get('role') ?? '';
    const isActiveFilter = searchParams.get('isActive');

    let whereClause;

    const conditions: ReturnType<typeof eq>[] = [];

    if (search) {
      conditions.push(or(
        like(users.name, `%${search}%`),
        like(users.email, `%${search}%`)
      ) as ReturnType<typeof eq>);
    }

    if (roleFilter) {
      conditions.push(eq(users.role, roleFilter as 'customer' | 'b2b'));
    }

    if (isActiveFilter !== null && isActiveFilter !== '') {
      conditions.push(eq(users.isActive, isActiveFilter === 'true'));
    }

    if (conditions.length > 0) {
      whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
    }

    const [data, countResult] = await Promise.all([
      db.query.users.findMany({
        where: whereClause,
        columns: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          pointsBalance: true,
          createdAt: true,
        },
        orderBy: [desc(users.createdAt)],
        limit,
        offset,
      }),
      db.select({ count: sql`count(*)` }).from(users).where(whereClause ?? eq(users.role, 'customer')),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return success({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('[Admin/Customers/GET]', { error });
    return serverError(error);
  }
}, 'admin');