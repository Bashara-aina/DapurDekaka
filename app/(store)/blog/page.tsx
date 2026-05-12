import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { BlogCard } from '@/components/store/blog/BlogCard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Blog - Dapur Dekaka',
  description: 'Artikel dan tips seputar makanan frozen, resep, dan informasi menarik dari Dapur Dekaka. Temukan inspirasi memasak dengan produk frozen food premium.',
  keywords: ['blog', 'resep', 'makanan frozen', 'tips memasak', 'dapur dekaka'],
  openGraph: {
    title: 'Blog - Dapur Dekaka',
    description: 'Artikel dan tips seputar makanan frozen dan inspirasi memasak.',
    url: 'https://dapurdekaka.com/blog',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const revalidate = 3600;

async function getPublishedPosts() {
  return await db.query.blogPosts.findMany({
    where: eq(blogPosts.isPublished, true),
    orderBy: [desc(blogPosts.publishedAt)],
  });
}

export default async function BlogPage() {
  const posts = await getPublishedPosts();

  return (
    <div className="container py-8 md:py-12 pb-20 md:pb-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold mb-2">Blog</h1>
        <p className="text-text-secondary">
          Artikel dan tips seputar makanan frozen, resep, dan informasi menarik.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-24 h-24 mx-auto mb-4 bg-brand-cream rounded-full flex items-center justify-center">
            <span className="text-4xl">📝</span>
          </div>
          <h2 className="font-display text-xl font-semibold mb-2">Artikel segera hadir</h2>
          <p className="text-text-secondary">
            Kami sedang menyiapkan konten terbaik untuk Anda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}