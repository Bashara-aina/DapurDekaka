import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, unauthorized, forbidden, notFound, serverError } from '@/lib/utils/api-response';
import { z } from 'zod';

const UpdateSettingSchema = z.object({
  value: z.string().min(1),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (role !== 'superadmin') {
      return forbidden();
    }

    const { key } = await params;
    const body = await req.json();
    const parsed = UpdateSettingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Data tidak valid' },
        { status: 422 }
      );
    }

    const { value } = parsed.data;

    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);

    if (!existing) {
      return notFound('Pengaturan tidak ditemukan');
    }

    await db
      .update(systemSettings)
      .set({ value, updatedBy: session.user.id, updatedAt: new Date() })
      .where(eq(systemSettings.key, key));

    return success({ key, value, message: 'Pengaturan berhasil diperbarui' });
  } catch (error) {
    console.error('[admin/settings/:key]', error);
    return serverError(error);
  }
}