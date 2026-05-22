import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { BlogCard } from '@/components/store/blog/BlogCard';

export async function LatestBlogPosts() {
  const posts = await db.query.blogPosts.findMany({
    where: and(eq(blogPosts.isPublished, true), isNull(blogPosts.deletedAt)),
    orderBy: [desc(blogPosts.publishedAt)],
    limit: 3,
    with: { category: true },
  });

  if (posts.length === 0) return null;

  return (
    <section className="py-12 bg-white">
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold">Dari Blog Kami</h2>
          <Link href="/blog" className="text-brand-red text-sm font-medium hover:underline">
            Semua Artikel →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {posts.map(post => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </section>
  );
}