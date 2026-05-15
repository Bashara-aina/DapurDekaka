import { NextRequest, NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { success, unauthorized, forbidden, serverError, badRequest } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { categories } from '@/lib/db/schema';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const includeInactive = req.nextUrl.searchParams.get('includeInactive') === 'true';

    const allCategories = await db.query.categories.findMany({
      where: includeInactive ? undefined : eq(categories.isActive, true),
      orderBy: [asc(categories.sortOrder)],
    });

    return success(allCategories);
  } catch (error) {
    console.error('[Admin/Categories/GET]', error);
    return serverError(error);
  }
}

const createCategorySchema = z.object({
  nameId: z.string().min(1, 'Nama Indonesia wajib diisi'),
  nameEn: z.string().min(1, 'Nama English wajib diisi'),
  slug: z.string().min(1, 'Slug wajib diisi'),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const body = await req.json();
    const parsed = createCategorySchema.safeParse(body);

    if (!parsed.success) {
      const errMsg = parsed.error.errors[0]?.message ?? 'Validasi gagal';
      return badRequest(errMsg);
    }

    const { nameId, nameEn, slug, sortOrder, isActive } = parsed.data;

    const existing = await db.query.categories.findFirst({
      where: eq(categories.slug, slug),
    });

    if (existing) {
      return badRequest('Slug sudah digunakan. Gunakan slug lain.');
    }

    let finalSortOrder = sortOrder ?? 0;
    if (sortOrder === undefined) {
      const maxSort = await db.query.categories.findFirst({
        orderBy: [asc(categories.sortOrder)],
        columns: { sortOrder: true },
      });
      if (maxSort && maxSort.sortOrder !== null) {
        finalSortOrder = maxSort.sortOrder + 1;
      }
    }

    const [newCategory] = await db
      .insert(categories)
      .values({
        nameId,
        nameEn,
        slug,
        sortOrder: finalSortOrder,
        isActive: isActive ?? true,
      })
      .returning();

    return success(newCategory, 201);
  } catch (error) {
    console.error('[Admin/Categories/POST]', error);
    return serverError(error);
  }
}