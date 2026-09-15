import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { success, notFound, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, sessions } from '@/lib/db/schema';
import { z } from 'zod';
import { logAdminActivity } from '@/lib/services/audit.service';
import { getClientIp, getUserAgent } from '@/lib/utils/request-meta';
import { logger } from '@/lib/utils/logger';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    const oldIsActive = existing.isActive;

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
    const roleChanged = parsed.data.role !== undefined && parsed.data.role !== oldRole;
    if (roleChanged) {
      await db.delete(sessions).where(eq(sessions.userId, id));
    }

    const newIsActive = parsed.data.isActive ?? oldIsActive;
    const ip = getClientIp(req);
    const ua = getUserAgent(req);

    // Audit log — non-blocking, captures IP/UA for AUDIT-05 #9 compliance.
    logAdminActivity({
      userId: session.user.id,
      action: roleChanged ? 'user.role_changed' : 'user.isactive_changed',
      targetType: 'user',
      targetId: id,
      beforeState: { role: oldRole, isActive: oldIsActive },
      afterState: { role: parsed.data.role ?? oldRole, isActive: newIsActive },
      ipAddress: ip,
      userAgent: ua,
    });

    logger.info('[admin/users/PATCH] role/active changed', {
      actorId: session.user.id,
      targetUserId: id,
      before: { role: oldRole, isActive: oldIsActive },
      after: { role: parsed.data.role ?? oldRole, isActive: newIsActive },
      ip,
    });

    return success(updated);
  } catch (error) {
    logger.error('[admin/users/PATCH]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return serverError(error);
  }
}