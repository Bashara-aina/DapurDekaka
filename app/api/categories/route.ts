import { NextResponse } from 'next/server';
import { success, serverError } from '@/lib/utils/api-response';
import { db } from '@/lib/db';
import { categories, products } from '@/lib/db/schema';
import { eq, isNull, sql, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const allCategories = await db.query.categories.findMany({
      where: isNull(categories.deletedAt),
      orderBy: [asc(categories.sortOrder), asc(categories.nameId)],
    });

    const categoriesWithCount = await Promise.all(
      allCategories.map(async (cat) => {
        const [result] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(products)
          .where(eq(products.categoryId, cat.id));

        return {
          ...cat,
          productCount: result?.count ?? 0,
        };
      })
    );

    return success(categoriesWithCount);

  } catch (error) {
    console.error('[api/categories]', error);
    return serverError(error);
  }
}