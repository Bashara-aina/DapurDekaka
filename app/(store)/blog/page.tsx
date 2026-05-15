import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { blogPosts, blogCategories } from '@/lib/db/schema';
import { eq, desc, and, isNull, or, like } from 'drizzle-orm';
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

interface BlogPageProps {
  searchParams: Promise<{ q?: string; category?: string }>;
}

async function getPosts(search?: string, categoryId?: string) {
  const conditions = [eq(blogPosts.isPublished, true)];

  if (search) {
    conditions.push(or(
      like(blogPosts.titleId, `%${search}%`),
      like(blogPosts.titleEn, `%${search}%`),
      like(blogPosts.excerptId, `%${search}%`)
    ) as NonNullable<typeof conditions[number]>);
  }

  if (categoryId) {
    conditions.push(eq(blogPosts.blogCategoryId, categoryId) as NonNullable<typeof conditions[number]>);
  }

  return await db.query.blogPosts.findMany({
    where: and(...conditions),
    orderBy: [desc(blogPosts.publishedAt)],
    with: { category: true },
  });
}

async function getCategories() {
  return await db.query.blogCategories.findMany({
    orderBy: [blogCategories.sortOrder],
  });
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const search = params.q || '';
  const categoryId = params.category || '';
  const [posts, categories] = await Promise.all([getPosts(search, categoryId), getCategories()]);

  return (
    <div className="container py-8 md:py-12 pb-20 md:pb-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold mb-2">Blog</h1>
        <p className="text-text-secondary">
          Artikel dan tips seputar makanan frozen, resep, dan informasi menarik.
        </p>
      </div>

      {/* Search and Filter */}
      <div className="mb-8 flex flex-col sm:flex-row gap-3">
        <form method="GET" action="/blog" className="flex-1 flex gap-2">
          {categoryId && <input type="hidden" name="category" value={categoryId} />}
          <input
            type="text"
            name="q"
            defaultValue={search}
            placeholder="Cari artikel..."
            className="flex-1 h-11 px-4 rounded-button border border-brand-cream-dark bg-white text-sm focus:outline-none focus:border-brand-red"
          />
          {search && (
            <a href="/blog" className="h-11 px-4 flex items-center text-sm text-text-secondary hover:text-brand-red">
              Reset
            </a>
          )}
          <button
            type="submit"
            className="h-11 px-4 bg-brand-red text-white text-sm font-medium rounded-button hover:bg-brand-red-dark transition-colors"
          >
            Cari
          </button>
        </form>
        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <a
              href="/blog"
              className={`h-11 px-4 rounded-button border text-sm font-medium transition-colors flex items-center ${
                !categoryId ? 'border-brand-red bg-brand-red text-white' : 'border-brand-cream-dark bg-white text-text-primary hover:border-brand-red'
              }`}
            >
              Semua
            </a>
            {categories.map((cat) => (
              <a
                key={cat.id}
                href={`/blog?category=${cat.id}`}
                className={`h-11 px-4 rounded-button border text-sm font-medium transition-colors flex items-center ${
                  categoryId === cat.id ? 'border-brand-red bg-brand-red text-white' : 'border-brand-cream-dark bg-white text-text-primary hover:border-brand-red'
                }`}
              >
                {cat.nameId}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Active filters display */}
      {(search || categoryId) && (
        <div className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
          <span>Menampilkan:</span>
          {search && <span className="px-2 py-1 bg-brand-cream rounded">Pencarian: &quot;{search}&quot;</span>}
          {categoryId && categories.find(c => c.id === categoryId) && (
            <span className="px-2 py-1 bg-brand-cream rounded">
              Kategori: {categories.find(c => c.id === categoryId)?.nameId}
            </span>
          )}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-24 h-24 mx-auto mb-4 bg-brand-cream rounded-full flex items-center justify-center">
            <span className="text-4xl">📝</span>
          </div>
          <h2 className="font-display text-xl font-semibold mb-2">Artikel tidak ditemukan</h2>
          <p className="text-text-secondary">
            Coba gunakan kata kunci lain atau hapus filter.
          </p>
          <a href="/blog" className="mt-4 inline-block px-4 py-2 bg-brand-red text-white text-sm font-medium rounded-button hover:bg-brand-red-dark">
            Lihat Semua Artikel
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <BlogCard key={post.id} post={post as Parameters<typeof BlogCard>[0]['post']} />
          ))}
        </div>
      )}
    </div>
  );
}