import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { sql, desc, eq, isNull, and } from 'drizzle-orm';
import { success, forbidden, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return forbidden('Akses ditolak');

    const role = session.user.role;
    if (role !== 'superadmin' && role !== 'owner') return forbidden('Anda tidak memiliki akses');

    // published: isPublished = true AND publishedAt IS NOT NULL
    // draft: isPublished = false OR (isPublished = true AND publishedAt IS NULL)
    // scheduled: isPublished = true AND publishedAt > now

    const now = new Date();

    const [publishedResult, draftResult, scheduledResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(blogPosts)
        .where(and(eq(blogPosts.isPublished, true), sql`${blogPosts.publishedAt} IS NOT NULL`)),
      db.select({ count: sql<number>`count(*)::int` }).from(blogPosts)
        .where(eq(blogPosts.isPublished, false)),
      db.select({ count: sql<number>`count(*)::int` }).from(blogPosts)
        .where(and(eq(blogPosts.isPublished, true), sql`${blogPosts.publishedAt} > ${now}`)),
    ]);

    const drafts = await db
      .select({ id: blogPosts.id, titleId: blogPosts.titleId, updatedAt: blogPosts.updatedAt })
      .from(blogPosts)
      .where(eq(blogPosts.isPublished, false))
      .orderBy(desc(blogPosts.updatedAt))
      .limit(5);

    return success({
      publishedCount: publishedResult[0]?.count ?? 0,
      draftCount: draftResult[0]?.count ?? 0,
      scheduledCount: scheduledResult[0]?.count ?? 0,
      drafts: drafts.map(d => ({
        ...d,
        updatedAt: d.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[admin/team-dashboard/blog-status]', error);
    return serverError(error);
  }
}