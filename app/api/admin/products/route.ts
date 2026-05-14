import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { products, categories, productVariants, productImages } from '@/lib/db/schema';
import { eq, desc, and, isNull, sql, like, or } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') ?? '';
    const categoryId = searchParams.get('categoryId') ?? '';
    const isActive = searchParams.get('isActive');

    const conditions: ReturnType<typeof isNull>[] = [isNull(products.deletedAt)];

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          like(products.nameId, searchPattern),
          like(products.nameEn, searchPattern),
          like(products.slug, searchPattern)
        )!
      );
    }

    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId));
    }

    if (isActive !== null && isActive !== '') {
      conditions.push(eq(products.isActive, isActive === 'true'));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [productList, totalResult] = await Promise.all([
      db.query.products.findMany({
        where: whereClause,
        with: {
          category: true,
          images: true,
          variants: { where: eq(productVariants.isActive, true) },
        },
        orderBy: [desc(products.createdAt)],
        limit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(whereClause)
        .execute()
        .then(r => r[0]?.count ?? 0),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        products: productList,
        pagination: {
          page,
          limit,
          total: totalResult,
          totalPages: Math.ceil(totalResult / limit),
        },
      },
    });
  } catch (error) {
    console.error('[Admin Products GET]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

const CreateProductSchema = z.object({
  categoryId: z.string().uuid('ID kategori tidak valid'),
  nameId: z.string().min(1).max(255, 'Nama Indonesia maksimal 255 karakter'),
  nameEn: z.string().min(1).max(255, 'Nama English maksimal 255 karakter'),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan strip'),
  descriptionId: z.string().optional(),
  descriptionEn: z.string().optional(),
  shortDescriptionId: z.string().max(500).optional(),
  shortDescriptionEn: z.string().max(500).optional(),
  weightGram: z.number().int().nonnegative().default(0),
  isHalal: z.boolean().default(true),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isB2bAvailable: z.boolean().default(true),
  isPreOrder: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0),
  metaTitleId: z.string().max(255).optional(),
  metaTitleEn: z.string().max(255).optional(),
  metaDescriptionId: z.string().max(500).optional(),
  metaDescriptionEn: z.string().max(500).optional(),
  shopeeUrl: z.string().url().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = CreateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const slugAlreadyExists = await db.query.products.findFirst({
      where: eq(products.slug, parsed.data.slug),
    });
    if (slugAlreadyExists) {
      return NextResponse.json(
        { success: false, error: 'Slug sudah digunakan produk lain', code: 'DUPLICATE_SLUG' },
        { status: 409 }
      );
    }

    const categoryExists = await db.query.categories.findFirst({
      where: eq(categories.id, parsed.data.categoryId),
    });
    if (!categoryExists) {
      return NextResponse.json(
        { success: false, error: 'Kategori tidak ditemukan', code: 'CATEGORY_NOT_FOUND' },
        { status: 404 }
      );
    }

    const [created] = await db
      .insert(products)
      .values({
        categoryId: parsed.data.categoryId,
        nameId: parsed.data.nameId,
        nameEn: parsed.data.nameEn,
        slug: parsed.data.slug,
        descriptionId: parsed.data.descriptionId ?? null,
        descriptionEn: parsed.data.descriptionEn ?? null,
        shortDescriptionId: parsed.data.shortDescriptionId ?? null,
        shortDescriptionEn: parsed.data.shortDescriptionEn ?? null,
        weightGram: parsed.data.weightGram,
        isHalal: parsed.data.isHalal,
        isActive: parsed.data.isActive,
        isFeatured: parsed.data.isFeatured,
        isB2bAvailable: parsed.data.isB2bAvailable,
        isPreOrder: parsed.data.isPreOrder,
        sortOrder: parsed.data.sortOrder,
        metaTitleId: parsed.data.metaTitleId ?? null,
        metaTitleEn: parsed.data.metaTitleEn ?? null,
        metaDescriptionId: parsed.data.metaDescriptionId ?? null,
        metaDescriptionEn: parsed.data.metaDescriptionEn ?? null,
        shopeeUrl: parsed.data.shopeeUrl ?? null,
      })
      .returning();

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error('[Admin Products POST]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}