import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq, sql, desc, and, gte } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role ?? '')) {
      return forbidden();
    }

    const publishedPosts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(blogPosts)
      .where(eq(blogPosts.isPublished, true));

    const draftPosts = await db.query.blogPosts.findMany({
      where: eq(blogPosts.isPublished, false),
      orderBy: [desc(blogPosts.updatedAt)],
      limit: 5,
    });

    const scheduledPosts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.isPublished, false),
          gte(blogPosts.publishedAt, new Date())
        )
      );

    return success({
      publishedCount: publishedPosts[0]?.count ?? 0,
      draftCount: draftPosts.length,
      scheduledCount: scheduledPosts[0]?.count ?? 0,
      drafts: draftPosts.map(p => ({
        id: p.id,
        titleId: p.titleId,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    console.error('[admin/team-dashboard/blog-status]', error);
    return serverError(error);
  }
}