import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { success, notFound, unauthorized, forbidden, serverError, conflict } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { products, productVariants, productImages, categories } from '@/lib/db/schema';
import { z } from 'zod';

const UpdateProductSchema = z.object({
  categoryId: z.string().uuid('ID kategori tidak valid').optional(),
  nameId: z.string().min(1).max(255).optional(),
  nameEn: z.string().min(1).max(255).optional(),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan strip')
    .optional(),
  descriptionId: z.string().optional().nullable(),
  descriptionEn: z.string().optional().nullable(),
  shortDescriptionId: z.string().max(500).optional().nullable(),
  shortDescriptionEn: z.string().max(500).optional().nullable(),
  weightGram: z.number().int().nonnegative().optional(),
  isHalal: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isB2bAvailable: z.boolean().optional(),
  isPreOrder: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  metaTitleId: z.string().max(255).optional().nullable(),
  metaTitleEn: z.string().max(255).optional().nullable(),
  metaDescriptionId: z.string().max(500).optional().nullable(),
  metaDescriptionEn: z.string().max(500).optional().nullable(),
  shopeeUrl: z.string().url().optional().nullable().or(z.literal('')),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { id } = await params;

    const product = await db.query.products.findFirst({
      where: and(eq(products.id, id), isNull(products.deletedAt)),
      with: {
        variants: true,
        images: { orderBy: (t, { asc }) => [asc(t.sortOrder)] },
        category: true,
      },
    });

    if (!product) {
      return notFound('Produk tidak ditemukan');
    }

    return success(product);
  } catch (error) {
    console.error('[Admin/Products/GET id]', error);
    return serverError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateProductSchema.safeParse(body);

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

    const existing = await db.query.products.findFirst({
      where: and(eq(products.id, id), isNull(products.deletedAt)),
    });

    if (!existing) {
      return notFound('Produk tidak ditemukan');
    }

    // Check slug uniqueness if changed
    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      const slugExists = await db.query.products.findFirst({
        where: and(eq(products.slug, parsed.data.slug), isNull(products.deletedAt)),
      });
      if (slugExists) {
        return conflict('Slug sudah digunakan produk lain');
      }
    }

    // Check category if changed
    if (parsed.data.categoryId && parsed.data.categoryId !== existing.categoryId) {
      const categoryExists = await db.query.categories.findFirst({
        where: eq(categories.id, parsed.data.categoryId),
      });
      if (!categoryExists) {
        return notFound('Kategori tidak ditemukan');
      }
    }

    const [updated] = await db
      .update(products)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .returning();

    return success(updated);
  } catch (error) {
    console.error('[Admin/Products/PATCH id]', error);
    return serverError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { id } = await params;

    const existing = await db.query.products.findFirst({
      where: and(eq(products.id, id), isNull(products.deletedAt)),
    });

    if (!existing) {
      return notFound('Produk tidak ditemukan');
    }

    // Soft delete
    await db
      .update(products)
      .set({ deletedAt: new Date(), isActive: false })
      .where(eq(products.id, id));

    return success({ message: 'Produk berhasil dihapus' });
  } catch (error) {
    console.error('[Admin/Products/DELETE id]', error);
    return serverError(error);
  }
}