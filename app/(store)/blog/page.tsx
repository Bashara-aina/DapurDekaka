import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db';
import { blogPosts, blogCategories } from '@/lib/db/schema';
import { eq, desc, and, or, like, sql } from 'drizzle-orm';
import { BlogCard } from '@/components/store/blog/BlogCard';
import { BlogSearchForm } from '@/components/store/blog/BlogSearchForm';

export const revalidate = 3600;

interface BlogPageProps {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}

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
  alternates: {
    canonical: 'https://dapurdekaka.com/blog',
  },
  robots: {
    index: true,
    follow: true,
  },
};

const POSTS_PER_PAGE = 12;

async function getPosts(search?: string, categoryId?: string, page: number = 1) {
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
    limit: POSTS_PER_PAGE,
    offset: (page - 1) * POSTS_PER_PAGE,
    with: { category: true },
  });
}

async function getTotalCount(search?: string, categoryId?: string): Promise<number> {
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

  const result = await db
    .select({ count: sql<number>`count(*)`.as('count') })
    .from(blogPosts)
    .where(and(...conditions));
  return Number(result[0]?.count ?? 0);
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
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const [posts, categories, totalCount] = await Promise.all([
    getPosts(search, categoryId, page),
    getCategories(),
    getTotalCount(search, categoryId),
  ]);

  const totalPages = Math.ceil(totalCount / POSTS_PER_PAGE);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const featuredPost = posts.length > 0 ? posts[0] : null;
  const remainingPosts = posts.slice(1);

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
        <BlogSearchForm defaultValue={search} />
        {categoryId && <input type="hidden" name="category" value={categoryId} />}
        {search && (
          <a href="/blog" className="h-11 px-4 flex items-center text-sm text-text-secondary hover:text-brand-red">
            Reset
          </a>
        )}
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
        <>
          {/* Featured post - first item */}
          {featuredPost && (
            <div className="mb-8">
              <Link href={`/blog/${featuredPost.slug}`} className="group">
                <div className="relative rounded-2xl overflow-hidden bg-brand-cream">
                  {featuredPost.coverImageUrl ? (
                    <div className="relative h-72 md:h-96">
                      <Image
                        src={featuredPost.coverImageUrl}
                        alt={featuredPost.titleId}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        priority
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-0 left-0 p-6 text-white">
                        {featuredPost.category && (
                          <span className="inline-block px-3 py-1 bg-brand-red text-xs font-medium rounded-full mb-3">
                            {featuredPost.category.nameId}
                          </span>
                        )}
                        <h2 className="font-display text-2xl md:text-3xl font-bold mb-2 line-clamp-2">
                          {featuredPost.titleId}
                        </h2>
                        {featuredPost.excerptId && (
                          <p className="text-white/80 text-sm line-clamp-2">{featuredPost.excerptId}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-72 md:h-96">
                      <Image
                        src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/f_webp,q_auto,w_1600/dapurdekaka/gallery/gallery-01`}
                        alt={featuredPost.titleId}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        priority
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-0 left-0 p-6 text-white">
                        {featuredPost.category && (
                          <span className="inline-block px-3 py-1 bg-brand-red text-xs font-medium rounded-full mb-3">
                            {featuredPost.category.nameId}
                          </span>
                        )}
                        <h2 className="font-display text-2xl md:text-3xl font-bold mb-2 line-clamp-2">
                          {featuredPost.titleId}
                        </h2>
                        {featuredPost.excerptId && (
                          <p className="text-white/80 text-sm line-clamp-2">{featuredPost.excerptId}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            </div>
          )}

          {/* Remaining posts in grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {remainingPosts.map((post) => (
              <BlogCard key={post.id} post={post as Parameters<typeof BlogCard>[0]['post']} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {hasPrevPage ? (
                <a
                  href={`/blog?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(categoryId ? { category: categoryId } : {}), page: String(page - 1) }).toString()}`}
                  className="px-4 py-2 border border-brand-cream-dark rounded-button text-sm font-medium text-text-primary hover:border-brand-red hover:text-brand-red transition-colors"
                >
                  ← Sebelumnya
                </a>
              ) : (
                <span className="px-4 py-2 border border-brand-cream-dark rounded-button text-sm font-medium text-text-muted cursor-not-allowed">
                  ← Sebelumnya
                </span>
              )}
              <span className="px-4 py-2 text-sm text-text-secondary">
                Halaman {page} dari {totalPages}
              </span>
              {hasNextPage ? (
                <a
                  href={`/blog?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(categoryId ? { category: categoryId } : {}), page: String(page + 1) }).toString()}`}
                  className="px-4 py-2 border border-brand-cream-dark rounded-button text-sm font-medium text-text-primary hover:border-brand-red hover:text-brand-red transition-colors"
                >
                  Selanjutnya →
                </a>
              ) : (
                <span className="px-4 py-2 border border-brand-cream-dark rounded-button text-sm font-medium text-text-muted cursor-not-allowed">
                  Selanjutnya →
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}