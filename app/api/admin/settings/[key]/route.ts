import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { success, notFound, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { z } from 'zod';
import { logAdminActivity } from '@/lib/services/audit.service';
import { invalidateSetting } from '@/lib/settings/get-settings';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/utils/rate-limit';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UpdateSettingSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const PATCH = withRateLimit(async (
  req: NextRequest,
  context?: { params: Promise<{ key: string }> }
) => {
  try {
    const params = context?.params ?? Promise.resolve({ key: '' });
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Hanya superadmin/owner yang dapat mengubah pengaturan sistem');
    }

    const { key } = await params;

    // Owner may edit store/shipping/promo ops keys; secrets & payment remain superadmin.
    const OWNER_EDITABLE_PREFIXES = [
      'store_',
      'biteship_origin_',
      'promo_',
      'instagram_',
      'wa_',
      'soft_launch_',
      'carousel_',
      'shipping_phase',
      'free_shipping_threshold',
      'og_image_',
      'seo_',
      'founding_',
      'price_range_',
      'tokopedia_',
      'shopee_',
      'admin_email',
      'points_',
      'b2b_points_',
    ] as const;
    if (role === 'owner') {
      const allowed = OWNER_EDITABLE_PREFIXES.some(
        (p) => key === p || key.startsWith(p)
      );
      if (!allowed) {
        return forbidden('Owner hanya dapat mengubah pengaturan toko/pengiriman/promo');
      }
    }
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

    invalidateSetting(key);

    // Audit log — non-blocking
    logAdminActivity({
      userId: session.user.id,
      action: 'setting_changed',
      targetType: 'system_setting',
      targetId: key,
      beforeState: { value: existing.value },
      afterState: { value: String(parsed.data.value) },
    }).catch((e: unknown) => logger.warn('[Audit] Failed to log setting change:', { error: e instanceof Error ? e.message : String(e) }));

    return success(updated);
  } catch (error) {
    return serverError(error);
  }
}, 'admin');

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin'].includes(role)) {
      return forbidden('Hanya superadmin yang dapat menghapus pengaturan sistem');
    }

    const { key } = await params;

    const existing = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, key),
    });

    if (!existing) {
      return notFound('Pengaturan tidak ditemukan');
    }

    await db
      .delete(systemSettings)
      .where(eq(systemSettings.key, key));

    invalidateSetting(key);

    logAdminActivity({
      userId: session.user.id,
      action: 'setting_deleted',
      targetType: 'system_setting',
      targetId: key,
      beforeState: { value: existing.value, type: existing.type },
    }).catch((e: unknown) => logger.warn('[Audit] Failed to log setting delete:', { error: e instanceof Error ? e.message : String(e) }));

    return success({ key });
  } catch (error) {
    return serverError(error);
  }
}