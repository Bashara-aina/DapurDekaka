import { NextRequest, NextResponse } from 'next/server';
import { success, serverError } from '@/lib/utils/api-response';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq, and, isNotNull, isNull, desc, like, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)));
    const categorySlug = searchParams.get('category') ?? '';
    const search = searchParams.get('search') ?? '';
    const offset = (page - 1) * limit;

    const whereConditions = [
      eq(blogPosts.isPublished, true),
      isNull(blogPosts.deletedAt),
      isNotNull(blogPosts.publishedAt),
    ];

    const posts = await db.query.blogPosts.findMany({
      where: and(...whereConditions),
      with: {
        category: true,
        author: {
          columns: {
            name: true,
            image: true,
          },
        },
      },
      orderBy: [desc(blogPosts.publishedAt)],
      limit,
      offset,
    });

    const postsWithReadingTime = posts.map(post => ({
      ...post,
      readingTime: calculateReadingTime(post.contentId || post.contentEn || ''),
      authorName: post.author?.name ?? 'Tim Dapur Dekaka',
    }));

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(blogPosts)
      .where(and(...whereConditions));

    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return success({
      posts: postsWithReadingTime,
      total,
      page,
      totalPages,
    });

  } catch (error) {
    console.error('[api/blog]', error);
    return serverError(error);
  }
}
