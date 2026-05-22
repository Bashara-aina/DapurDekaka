import { db } from '@/lib/db';
import { blogPostViews } from '@/lib/db/schema';

/**
 * Record a view for a blog post.
 * Call this in the blog post page server component after fetching the post.
 * Visitor tracking is optional - pass visitorId from cookies/headers for deduplication.
 */
export async function recordBlogView(params: {
  blogPostId: string;
  visitorId?: string;
  userId?: string;
}): Promise<void> {
  try {
    await db.insert(blogPostViews).values({
      blogPostId: params.blogPostId,
      visitorId: params.visitorId ?? null,
      userId: params.userId ?? null,
      viewedAt: new Date(),
    });
  } catch (error) {
    // Non-blocking - view tracking failures should not affect page render
    console.error('[BlogView] Failed to record view:', error instanceof Error ? error.message : String(error));
  }
}