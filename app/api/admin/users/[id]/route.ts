import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { success, notFound, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, sessions } from '@/lib/db/schema';
import { z } from 'zod';
import { logAdminActivity } from '@/lib/services/audit.service';

const UpdateUserRoleSchema = z.object({
  role: z.enum(['customer', 'b2b', 'warehouse', 'owner', 'superadmin']),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const currentRole = session.user.role;
    if (!currentRole || !['superadmin'].includes(currentRole)) {
      return forbidden('Hanya superadmin yang dapat mengubah role pengguna');
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateUserRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validasi gagal',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existing) {
      return notFound('Pengguna tidak ditemukan');
    }

    // Cannot demote yourself
    if (id === session.user.id && parsed.data.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Tidak dapat mengubah role sendiri', code: 'CANNOT_UPDATE_SELF' },
        { status: 400 }
      );
    }

    const oldRole = existing.role;

    const [updated] = await db
      .update(users)
      .set({
        ...(parsed.data.role !== undefined && { role: parsed.data.role }),
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    // Invalidate all sessions when role changes
    if (parsed.data.role !== undefined && parsed.data.role !== oldRole) {
      await db.delete(sessions).where(eq(sessions.userId, id));
    }

    // Audit log — non-blocking
    logAdminActivity({
      userId: session.user.id,
      action: 'user_role_changed',
      targetType: 'user',
      targetId: id,
      beforeState: { role: oldRole, isActive: existing.isActive },
      afterState: { role: parsed.data.role, isActive: parsed.data.isActive ?? existing.isActive },
    }).catch((e) => console.error('[Audit] Failed to log user role change:', e));

    return success(updated);
  } catch (error) {
    console.error('[Admin/Users/PATCH id]', error);
    return serverError(error);
  }
}