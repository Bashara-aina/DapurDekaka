import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { success, notFound, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { z } from 'zod';
import { logAdminActivity } from '@/lib/services/audit.service';

const UpdateSettingSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin'].includes(role)) {
      return forbidden('Hanya superadmin yang dapat mengubah pengaturan sistem');
    }

    const { key } = await params;
    const body = await req.json();
    const parsed = UpdateSettingSchema.safeParse(body);

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

    const existing = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, key),
    });

    if (!existing) {
      return notFound('Pengaturan tidak ditemukan');
    }

    const [updated] = await db
      .update(systemSettings)
      .set({
        value: String(parsed.data.value),
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.key, key))
      .returning();

    // Audit log — non-blocking
    logAdminActivity({
      userId: session.user.id,
      action: 'setting_changed',
      targetType: 'system_setting',
      targetId: key,
      beforeState: { value: existing.value },
      afterState: { value: String(parsed.data.value) },
    }).catch((e) => console.error('[Audit] Failed to log setting change:', e));

    return success(updated);
  } catch (error) {
    console.error('[Admin/Settings/PATCH key]', error);
    return serverError(error);
  }
}