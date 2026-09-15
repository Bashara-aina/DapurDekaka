import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { desc, isNull } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/check-role';
import BlogTableClient from './BlogTableClient';

export const dynamic = 'force-dynamic';

export default async function AdminBlogPage() {
  await requireRole(['superadmin', 'owner']);
  const allPosts = await db.query.blogPosts.findMany({
    where: isNull(blogPosts.deletedAt),
    orderBy: [desc(blogPosts.createdAt)],
  });

  return <BlogTableClient posts={allPosts} />;
}