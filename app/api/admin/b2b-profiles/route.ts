import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { b2bProfiles } from '@/lib/db/schema';
import { desc, eq, and, isNull, sql } from 'drizzle-orm';
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
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * limit;
    const status = searchParams.get('status'); // 'approved', 'pending', 'rejected'

    const conditions: ReturnType<typeof isNull>[] = [];

    if (status === 'approved') {
      conditions.push(eq(b2bProfiles.isApproved, true));
    } else if (status === 'pending') {
      conditions.push(eq(b2bProfiles.isApproved, false));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [profiles, totalResult] = await Promise.all([
      db.query.b2bProfiles.findMany({
        where: whereClause,
        with: {
          user: {
            columns: { id: true, name: true, email: true, phone: true },
          },
        },
        orderBy: [desc(b2bProfiles.createdAt)],
        limit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(b2bProfiles)
        .where(whereClause)
        .execute()
        .then(r => r[0]?.count ?? 0),
    ]);

    return success({
      profiles,
      pagination: {
        page,
        limit,
        total: totalResult,
        totalPages: Math.ceil(totalResult / limit),
      },
    });
  } catch (error) {
    console.error('[Admin B2B Profiles GET]', error);
    return serverError(error);
  }
}