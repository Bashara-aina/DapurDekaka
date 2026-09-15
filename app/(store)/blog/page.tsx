import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Clock, Sparkles, X } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { blogPosts, blogCategories } from '@/lib/db/schema';
import { eq, desc, and, or, like, sql } from 'drizzle-orm';
import { BlogCard } from '@/components/store/blog/BlogCard';
import { BlogSearchForm } from '@/components/store/blog/BlogSearchForm';
import { EmptyState } from '@/components/store/common/EmptyState';
import { formatBlogDate } from '@/lib/utils/format-date';
import { getReadingTime } from '@/lib/utils/reading-time';
import { getBlogCoverImage } from '@/lib/utils/blog-fallback-image';

export const revalidate = 600;

interface BlogPageProps {
  params: Promise<Record<string, string>>;
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return {
    title: t('blogTitle'),
    description: t('blogDescription'),
    keywords: ['blog', 'resep', 'makanan frozen', 'tips memasak', 'dapur dekaka'],
    openGraph: {
      title: t('blogTitle'),
      description: t('blogDescription'),
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
}

const POSTS_PER_PAGE = 12;

async function getPosts(search?: string, categorySlug?: string, page: number = 1) {
  const conditions = [eq(blogPosts.isPublished, true), sql`${blogPosts.deletedAt} IS NULL`];

  if (search) {
    conditions.push(or(
      like(blogPosts.titleId, `%${search}%`),
      like(blogPosts.titleEn, `%${search}%`),
      like(blogPosts.excerptId, `%${search}%`)
    ) as NonNullable<typeof conditions[number]>);
  }

  if (categorySlug) {
    const cat = await db.query.blogCategories.findFirst({
      where: eq(blogCategories.slug, categorySlug),
    });
    if (cat) {
      conditions.push(eq(blogPosts.blogCategoryId, cat.id) as NonNullable<typeof conditions[number]>);
    }
  }

  return await db.query.blogPosts.findMany({
    where: and(...conditions),
    orderBy: [desc(blogPosts.publishedAt)],
    limit: POSTS_PER_PAGE,
    offset: (page - 1) * POSTS_PER_PAGE,
    with: { category: true },
  });
}

async function getTotalCount(search?: string, categorySlug?: string): Promise<number> {
  const conditions = [eq(blogPosts.isPublished, true), sql`${blogPosts.deletedAt} IS NULL`];

  if (search) {
    conditions.push(or(
      like(blogPosts.titleId, `%${search}%`),
      like(blogPosts.titleEn, `%${search}%`),
      like(blogPosts.excerptId, `%${search}%`)
    ) as NonNullable<typeof conditions[number]>);
  }

  if (categorySlug) {
    const cat = await db.query.blogCategories.findFirst({
      where: eq(blogCategories.slug, categorySlug),
    });
    if (cat) {
      conditions.push(eq(blogPosts.blogCategoryId, cat.id) as NonNullable<typeof conditions[number]>);
    }
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

function buildBlogHref(opts: { q?: string; category?: string; page?: number }) {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.category) params.set('category', opts.category);
  if (opts.page && opts.page > 1) params.set('page', String(opts.page));
  const qs = params.toString();
  return qs ? `/blog?${qs}` : '/blog';
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const t = await getTranslations('blog');
  const locale = await getLocale();
  const isEn = locale === 'en';
  const params = await searchParams;
  const search = params.q || '';
  const categorySlug = params.category || '';
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const [posts, categories, totalCount] = await Promise.all([
    getPosts(search, categorySlug, page),
    getCategories(),
    getTotalCount(search, categorySlug),
  ]);

  const totalPages = Math.ceil(totalCount / POSTS_PER_PAGE);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  const isFiltering = Boolean(search || categorySlug);
  // Only treat the very first post as "featured" on the clean first page.
  // On search / filter / paginated views every post gets equal card treatment.
  const showFeatured = !isFiltering && page === 1;
  const featuredPost = showFeatured && posts.length > 0 ? posts[0] : null;
  const remainingPosts = featuredPost ? posts.slice(1) : posts;
  const activeCategory = categories.find((c) => c.slug === categorySlug);

  const localizeTitle = (post: { titleId: string; titleEn: string }) =>
    isEn && post.titleEn ? post.titleEn : post.titleId;
  const localizeExcerpt = (post: { excerptId: string | null; excerptEn: string | null }) =>
    isEn && post.excerptEn ? post.excerptEn : post.excerptId;
  const localizeCategory = (cat: { nameId: string; nameEn: string }) =>
    isEn && cat.nameEn ? cat.nameEn : cat.nameId;

  return (
    <div className="bg-brand-cream min-h-screen">
      {/* Page header */}
      <div className="border-b border-brand-cream-dark bg-white">
        <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
          <nav aria-label="Breadcrumb" className="mb-4 text-sm">
            <ol className="flex items-center gap-1.5 text-text-secondary">
              <li>
                <Link href="/" className="transition-colors hover:text-brand-red">
                  Beranda
                </Link>
              </li>
              <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
              <li aria-current="page" className="font-medium text-text-primary">Blog</li>
            </ol>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-2">{t('title')}</h1>
              <p className="text-text-secondary text-base leading-relaxed">{t('description')}</p>
            </div>
            {totalCount > 0 && (
              <p className="shrink-0 rounded-full bg-brand-cream px-3.5 py-1.5 text-sm font-medium text-text-secondary" aria-live="polite">
                {t('articlesFound', { count: totalCount })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-8">
        {/* Search + category filter */}
        <div className="rounded-2xl border border-brand-cream-dark bg-white p-4 md:p-5 shadow-card">
          <BlogSearchForm defaultValue={search} categorySlug={categorySlug} />
          {categories.length > 0 && (
            <div
              className="mt-4 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
              role="group"
              aria-label="Filter kategori"
            >
              <Link
                href={buildBlogHref({ q: search })}
                aria-current={!categorySlug ? 'true' : undefined}
                className={`h-9 shrink-0 inline-flex items-center rounded-full border px-4 text-sm font-medium transition-colors ${
                  !categorySlug
                    ? 'border-brand-red bg-brand-red text-white shadow-button'
                    : 'border-brand-cream-dark bg-white text-text-primary hover:border-brand-red hover:text-brand-red'
                }`}
              >
                {t('all')}
              </Link>
              {categories.map((cat) => {
                const active = categorySlug === cat.slug;
                return (
                  <Link
                    key={cat.id}
                    href={buildBlogHref({ q: search, category: cat.slug })}
                    aria-current={active ? 'true' : undefined}
                    className={`h-9 shrink-0 inline-flex items-center rounded-full border px-4 text-sm font-medium transition-colors ${
                      active
                        ? 'border-brand-red bg-brand-red text-white shadow-button'
                        : 'border-brand-cream-dark bg-white text-text-primary hover:border-brand-red hover:text-brand-red'
                    }`}
                  >
                    {localizeCategory(cat)}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Active filters */}
        {isFiltering && (
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
            <span>{t('showing')}</span>
            {search && (
              <Link
                href={buildBlogHref({ category: categorySlug })}
                className="inline-flex items-center gap-1.5 rounded-full bg-white border border-brand-cream-dark px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-brand-red hover:text-brand-red"
              >
                {t('search')} &quot;{search}&quot;
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">Hapus filter pencarian</span>
              </Link>
            )}
            {activeCategory && (
              <Link
                href={buildBlogHref({ q: search })}
                className="inline-flex items-center gap-1.5 rounded-full bg-white border border-brand-cream-dark px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-brand-red hover:text-brand-red"
              >
                {t('category')} {localizeCategory(activeCategory)}
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">Hapus filter kategori</span>
              </Link>
            )}
            <Link
              href="/blog"
              className="ml-1 text-sm font-medium text-brand-red hover:text-brand-red-dark hover:underline"
            >
              {t('reset')}
            </Link>
          </div>
        )}

        {posts.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-brand-cream-dark bg-white shadow-card">
            <EmptyState
              variant="blog"
              title={t('noArticles')}
              description={t('tryDifferentKeywords')}
              action={{ label: t('viewAllArticles'), href: '/blog' }}
            />
          </div>
        ) : (
          <>
            {/* Featured post */}
            {featuredPost && (
              <section aria-label={t('featured')} className="mt-8">
                <Link
                  href={`/blog/${featuredPost.slug}`}
                  className="group block overflow-hidden rounded-2xl bg-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2"
                >
                  <div className="grid md:grid-cols-2">
                    <div className="relative min-h-64 h-64 md:h-full md:min-h-[320px] overflow-hidden bg-brand-cream">
                      <Image
                        src={getBlogCoverImage(featuredPost.coverImageUrl, featuredPost.slug)}
                        alt={localizeTitle(featuredPost)}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        priority
                      />
                    </div>
                    <div className="flex flex-col justify-center p-6 md:p-10">
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-3 py-1 text-xs font-semibold text-white">
                          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                          {t('featured')}
                        </span>
                        {featuredPost.category && (
                          <span className="inline-flex items-center rounded-full bg-brand-red/10 px-3 py-1 text-xs font-semibold text-brand-red">
                            {localizeCategory(featuredPost.category)}
                          </span>
                        )}
                      </div>
                      <h2 className="font-display text-2xl md:text-[2rem] md:leading-tight font-bold text-text-primary transition-colors group-hover:text-brand-red">
                        {localizeTitle(featuredPost)}
                      </h2>
                      {localizeExcerpt(featuredPost) && (
                        <p className="mt-3 text-text-secondary leading-relaxed line-clamp-3">
                          {localizeExcerpt(featuredPost)}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-4 w-4" aria-hidden="true" />
                          {featuredPost.publishedAt ? formatBlogDate(featuredPost.publishedAt, locale) : 'Draft'}
                        </span>
                        <span aria-hidden="true" className="text-brand-cream-dark">•</span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-4 w-4" aria-hidden="true" />
                          {t('readTime', { minutes: getReadingTime(featuredPost.contentId || '') })}
                        </span>
                      </div>
                      <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-red">
                        {t('readMore')}
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </Link>
              </section>
            )}

            {/* Grid */}
            {remainingPosts.length > 0 && (
              <section aria-label={t('articles')} className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {remainingPosts.map((post) => (
                  <BlogCard
                    key={post.id}
                    locale={locale}
                    post={post as Parameters<typeof BlogCard>[0]['post']}
                  />
                ))}
              </section>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
                {hasPrevPage ? (
                  <Link
                    href={buildBlogHref({ q: search, category: categorySlug, page: page - 1 })}
                    className="inline-flex h-11 items-center gap-2 rounded-button border border-brand-cream-dark bg-white px-5 text-sm font-medium text-text-primary transition-colors hover:border-brand-red hover:text-brand-red"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    {t('prev')}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="inline-flex h-11 cursor-not-allowed items-center gap-2 rounded-button border border-brand-cream-dark bg-white/60 px-5 text-sm font-medium text-text-disabled"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    {t('prev')}
                  </span>
                )}
                <span className="px-2 text-sm text-text-secondary" aria-current="page">
                  {t('page')} {page} {t('of')} {totalPages}
                </span>
                {hasNextPage ? (
                  <Link
                    href={buildBlogHref({ q: search, category: categorySlug, page: page + 1 })}
                    className="inline-flex h-11 items-center gap-2 rounded-button border border-brand-cream-dark bg-white px-5 text-sm font-medium text-text-primary transition-colors hover:border-brand-red hover:text-brand-red"
                  >
                    {t('next')}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="inline-flex h-11 cursor-not-allowed items-center gap-2 rounded-button border border-brand-cream-dark bg-white/60 px-5 text-sm font-medium text-text-disabled"
                  >
                    {t('next')}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
