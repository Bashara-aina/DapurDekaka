import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { blogCategories } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { success, serverError, unauthorized, forbidden } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CreateCategorySchema = z.object({
  nameId: z.string().min(1, 'Nama ID wajib diisi'),
  nameEn: z.string().min(1, 'Nama EN wajib diisi'),
  slug: z.string().min(1, 'Slug wajib diisi'),
  sortOrder: z.number().int().optional().default(0),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role as string)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const categories = await db.query.blogCategories.findMany({
      orderBy: [asc(blogCategories.sortOrder)],
    });

    return success(categories);
  } catch (error) {
    console.error('[Admin Blog Categories GET]', error);
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role as string)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const body = await req.json();
    const parsed = CreateCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const [category] = await db.insert(blogCategories).values(parsed.data).returning();

    return success(category, 201);
  } catch (error) {
    console.error('[Admin Blog Categories POST]', error);
    return serverError(error);
  }
}