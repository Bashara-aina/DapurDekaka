import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pointsHistory } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { success, unauthorized, serverError } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return unauthorized('Silakan masuk terlebih dahulu');
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20', 10));
    const offset = (page - 1) * limit;

    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, session.user.id!),
      columns: {
        pointsBalance: true,
      },
    });

    const history = await db.query.pointsHistory.findMany({
      where: (ph, { eq }) => eq(ph.userId, session.user.id!),
      orderBy: [desc(pointsHistory.createdAt)],
      limit,
      offset,
    });

    const soonThreshold = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Separate unpaginated query so we capture ALL expiring points, not just the first page
    const expiringEntries = await db.query.pointsHistory.findMany({
      where: (ph, { and, eq, isNull, lte, gte }) => and(
        eq(ph.userId, session.user.id!),
        eq(ph.type, 'earn'),
        isNull(ph.consumedAt),
        eq(ph.isExpired, false),
        gte(ph.expiresAt, new Date()),
        lte(ph.expiresAt, soonThreshold),
      ),
    });

    const expiringPointsSum = expiringEntries.reduce((sum, e) => sum + e.pointsAmount, 0);

    return success({
      balance: user?.pointsBalance || 0,
      history,
      expiringCount: expiringEntries.length,
      expiringPoints: expiringPointsSum,
      page,
      hasMore: history.length === limit,
    });

  } catch (error) {
    console.error('[account/points GET]', error);
    return serverError(error);
  }
}