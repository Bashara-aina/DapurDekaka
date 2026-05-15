import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, pointsHistory } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { success, serverError, forbidden, badRequest } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';

const adjustSchema = z.object({
  userId: z.string().uuid('ID user tidak valid'),
  amount: z.number().int().refine((n) => n !== 0, 'Jumlah poin harus non-zero'),
  type: z.enum(['add', 'deduct']),
  reason: z.string().min(1, 'Alasan wajib diisi'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Hanya superadmin atau owner yang dapat menyesuaikan poin');
    }

    const body = await req.json();
    const parsed = adjustSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return badRequest(firstError ? firstError.message : 'Validasi gagal');
    }

    const { userId, amount, type, reason } = parsed.data;

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!targetUser) {
      return badRequest('Pengguna tidak ditemukan');
    }

    const adjustedAmount = type === 'deduct' ? -Math.abs(amount) : Math.abs(amount);
    const noteId = type === 'add'
      ? `Penyesuaian: ${reason}`
      : `Pengurangan poin: ${reason}`;
    const noteEn = type === 'add'
      ? `Adjustment: ${reason}`
      : `Points deduction: ${reason}`;

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          pointsBalance: sql`points_balance + ${adjustedAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      await tx.insert(pointsHistory).values({
        userId,
        type: 'adjust',
        pointsAmount: adjustedAmount,
        pointsBalanceAfter: sql`points_balance`,
        descriptionId: noteId,
        descriptionEn: noteEn,
      });
    });

    return success({
      userId,
      adjustedAmount,
      newBalance: (targetUser.pointsBalance ?? 0) + adjustedAmount,
      message: type === 'add'
        ? `Berhasil menambahkan ${amount} poin`
        : `Berhasil mengurangi ${amount} poin`,
    });
  } catch (error) {
    console.error('[admin/points/adjust]', error);
    return serverError(error);
  }
}