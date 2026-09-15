import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { blogCategories, blogPosts } from '@/lib/db/schema';
import {
  success,
  serverError,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  conflict,
} from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UpdateCategorySchema = z.object({
  nameId: z.string().min(1).max(100).optional(),
  nameEn: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login terlebih dahulu');

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateCategorySchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? 'Validasi gagal');
    }

    if (Object.keys(parsed.data).length === 0) {
      return badRequest('Tidak ada field yang diupdate');
    }

    const existing = await db.query.blogCategories.findFirst({
      where: eq(blogCategories.id, id),
    });
    if (!existing) return notFound('Kategori tidak ditemukan');

    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      const slugConflict = await db.query.blogCategories.findFirst({
        where: eq(blogCategories.slug, parsed.data.slug),
      });
      if (slugConflict && slugConflict.id !== id) {
        return conflict('Slug sudah digunakan oleh kategori lain');
      }
    }

    const [updated] = await db
      .update(blogCategories)
      .set(parsed.data)
      .where(eq(blogCategories.id, id))
      .returning();

    return success(updated);
  } catch (error) {
    logger.error('[Admin Blog Category PATCH]', { error });
    return serverError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login terlebih dahulu');

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { id } = await params;

    const existing = await db.query.blogCategories.findFirst({
      where: eq(blogCategories.id, id),
    });
    if (!existing) return notFound('Kategori tidak ditemukan');

    await db.transaction(async (tx) => {
      await tx
        .update(blogPosts)
        .set({ blogCategoryId: null })
        .where(eq(blogPosts.blogCategoryId, id));

      await tx.delete(blogCategories).where(eq(blogCategories.id, id));
    });

    return success({ id });
  } catch (error) {
    logger.error('[Admin Blog Category DELETE]', { error });
    return serverError(error);
  }
}