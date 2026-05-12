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

    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, session.user.id!),
      columns: {
        pointsBalance: true,
      },
    });

    const history = await db.query.pointsHistory.findMany({
      where: (ph, { eq }) => eq(ph.userId, session.user.id!),
      orderBy: [desc(pointsHistory.createdAt)],
      limit: 50,
    });

    const expiringPoints = history.filter(h =>
      h.expiresAt &&
      !h.isExpired &&
      new Date(h.expiresAt) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    );

    return success({
      balance: user?.pointsBalance || 0,
      history,
      expiringCount: expiringPoints.length,
    });

  } catch (error) {
    console.error('[account/points GET]', error);
    return serverError(error);
  }
}