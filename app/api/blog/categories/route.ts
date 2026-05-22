import { NextResponse } from 'next/server';
import { success, serverError } from '@/lib/utils/api-response';
import { db } from '@/lib/db';
import { blogCategories, blogPosts } from '@/lib/db/schema';
import { eq, isNull, sql, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const allCategories = await db.query.blogCategories.findMany({
      orderBy: [asc(blogCategories.sortOrder), asc(blogCategories.nameId)],
    });

    const categoriesWithCount = await Promise.all(
      allCategories.map(async (cat) => {
        const [result] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(blogPosts)
          .where(eq(blogPosts.blogCategoryId, cat.id));

        return {
          ...cat,
          postCount: result?.count ?? 0,
        };
      })
    );

    return success(categoriesWithCount);

  } catch (error) {
    console.error('[api/blog/categories]', error);
    return serverError(error);
  }
}
