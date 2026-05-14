import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { success, notFound, unauthorized, forbidden, serverError, conflict, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, pointsHistory } from '@/lib/db/schema';
import { z } from 'zod';

const AdjustPointsSchema = z.object({
  userId: z.string().uuid(),
  points: z.number().int().refine(v => v !== 0, 'Points tidak boleh 0'),
  type: z.enum(['earn', 'adjust']),
  descriptionId: z.string().min(1, 'Deskripsi Indonesia harus diisi'),
  descriptionEn: z.string().min(1, 'English description is required'),
  expiresAt: z.string().datetime().optional().nullable(),
  orderId: z.string().uuid().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses untuk menyesuaikan poin');
    }

    const body = await req.json();
    const parsed = AdjustPointsSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { userId, points, type, descriptionId, descriptionEn, expiresAt, orderId } = parsed.data;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return notFound('Pengguna tidak ditemukan');
    }

    const newBalance = user.pointsBalance + points;
    if (newBalance < 0) {
      return conflict('Poin tidak cukup untuk pengurangan ini');
    }

    await db.update(users).set({
      pointsBalance: newBalance,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    const [historyEntry] = await db.insert(pointsHistory).values({
      userId,
      type,
      pointsAmount: points,
      pointsBalanceAfter: newBalance,
      descriptionId,
      descriptionEn,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      orderId: orderId ?? null,
      adjustedBy: session.user.id,
    }).returning();

    return success({
      userId,
      previousBalance: user.pointsBalance,
      newBalance,
      change: points,
      historyEntry,
    });
  } catch (error) {
    console.error('[Admin Points Adjust POST]', error);
    return serverError(error);
  }
}