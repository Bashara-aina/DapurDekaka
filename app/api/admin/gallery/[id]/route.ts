import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { cmsGalleryImages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  success,
  forbidden,
  notFound,
  validationError,
  serverError,
} from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const usageEnum = z.enum(['instagram_feed', 'about_hero', 'og', 'general']);

const updateGallerySchema = z.object({
  publicId: z.string().min(1).max(255).optional(),
  altId: z.string().max(255).optional().nullable(),
  altEn: z.string().max(255).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  usage: usageEnum.optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Akses ditolak');
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateGallerySchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const [updated] = await db
      .update(cmsGalleryImages)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(cmsGalleryImages.id, id))
      .returning();

    if (!updated) return notFound('Gambar galeri tidak ditemukan');
    return success(updated);
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Akses ditolak');
    }

    const { id } = await params;
    const hardDelete = req.nextUrl.searchParams.get('hard') === 'true';

    if (hardDelete) {
      const [deleted] = await db
        .delete(cmsGalleryImages)
        .where(eq(cmsGalleryImages.id, id))
        .returning();

      if (!deleted) return notFound('Gambar galeri tidak ditemukan');
      return success({ deleted: true, hard: true });
    }

    const [updated] = await db
      .update(cmsGalleryImages)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(cmsGalleryImages.id, id))
      .returning();

    if (!updated) return notFound('Gambar galeri tidak ditemukan');
    return success({ deleted: true, hard: false, image: updated });
  } catch (error) {
    return serverError(error);
  }
}
