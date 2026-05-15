import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError, notFound, badRequest } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { categories } from '@/lib/db/schema';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateCategorySchema = z.object({
  nameId: z.string().min(1).optional(),
  nameEn: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) return forbidden('Tidak ada akses');

    const { id } = await params;
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, id),
    });

    if (!category) return notFound('Kategori tidak ditemukan');
    return success(category);
  } catch (error) {
    console.error('[Admin/Categories/[id]/GET]', error);
    return serverError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) return forbidden('Tidak ada akses');

    const { id } = await params;
    const body = await req.json();
    const parsed = updateCategorySchema.safeParse(body);

    if (!parsed.success) {
      const errMsg = parsed.error.errors[0]?.message ?? 'Validasi gagal';
      return badRequest(errMsg);
    }

    const updates: Record<string, unknown> = {};
    const { nameId, nameEn, slug, sortOrder, isActive } = parsed.data;
    if (nameId !== undefined) updates.nameId = nameId;
    if (nameEn !== undefined) updates.nameEn = nameEn;
    if (slug !== undefined) updates.slug = slug;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (isActive !== undefined) updates.isActive = isActive;

    if (Object.keys(updates).length === 0) {
      return badRequest('Tidak ada field yang diupdate');
    }

    const [updated] = await db
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning()
      .catch(() => []);

    if (!updated) return notFound('Kategori tidak ditemukan');
    return success(updated);
  } catch (error) {
    console.error('[Admin/Categories/[id]/PATCH]', error);
    return serverError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) return forbidden('Tidak ada akses');

    const { id } = await params;

    const [deleted] = await db
      .update(categories)
      .set({ isActive: false })
      .where(eq(categories.id, id))
      .returning();

    if (!deleted) return notFound('Kategori tidak ditemukan');
    return success({ message: 'Kategori dinonaktifkan' });
  } catch (error) {
    console.error('[Admin/Categories/[id]/DELETE]', error);
    return serverError(error);
  }
}