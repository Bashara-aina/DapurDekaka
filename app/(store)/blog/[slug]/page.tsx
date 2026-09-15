import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, ChevronRight, Clock, MessageCircle } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { sanitizeRichText } from '@/lib/utils/sanitize-html';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq, desc, and, ne, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { logger } from '@/lib/utils/logger';
import { recordBlogView } from '@/lib/services/blog-view.service';
import { BlogCard } from '@/components/store/blog/BlogCard';
import { ReadingProgress } from '@/components/store/blog/ReadingProgress';
import { BackToTop } from '@/components/store/blog/BackToTop';
import { TableOfContents } from '@/components/store/blog/TableOfContents';
import { BlogCTA } from '@/components/store/blog/BlogCTA';
import { CopyLinkButton } from '@/components/store/blog/CopyLinkButton';
import { formatBlogDate } from '@/lib/utils/format-date';
import { getBlogCoverImage } from '@/lib/utils/blog-fallback-image';

export const revalidate = 600;

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;

  const post = await db.query.blogPosts.findFirst({
    where: eq(blogPosts.slug, slug),
    with: {
      category: true,
    },
  });

  if (!post) {
    return {
      title: 'Artikel Tidak Ditemukan - Dapur Dekaka',
    };
  }

  const title = post.metaTitleId || post.titleId;
  const description = post.metaDescriptionId || post.excerptId ||
    `Baca artikel ${post.titleId} di blog Dapur Dekaka. Tips dan informasi seputar makanan frozen.`;

  return {
    title,
    description,
    keywords: [post.titleId, post.titleEn, 'blog', 'dapur dekaka', 'frozen food'].filter(Boolean) as string[],
    openGraph: {
      title,
      description,
      url: `https://dapurdekaka.com/blog/${slug}`,
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      authors: ['Dapur Dekaka'],
      images: post.coverImageUrl ? [
        {
          url: post.coverImageUrl,
          width: 1200,
          height: 630,
          alt: post.titleId,
        },
      ] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: post.coverImageUrl ? [post.coverImageUrl] : [],
    },
    alternates: {
      canonical: `https://dapurdekaka.com/blog/${slug}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export async function generateStaticParams() {
  try {
    const posts = await db.query.blogPosts.findMany({
      where: and(eq(blogPosts.isPublished, true), isNull(blogPosts.deletedAt)),
      columns: { slug: true },
    });
    return posts.map((post) => ({ slug: post.slug }));
  } catch (err) {
    // DB unavailable at build time (no DATABASE_URL); pages render on-demand via ISR
    logger.warn('[blog/slug] generateStaticParams failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, '');
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const isEn = locale === 'en';
  const t = await getTranslations('blog');

  const post = await db.query.blogPosts.findFirst({
    where: eq(blogPosts.slug, slug),
    with: {
      category: true,
      author: true,
    },
  }) as (Omit<typeof blogPosts.$inferSelect, 'deletedAt' | 'updatedAt' | 'createdAt' | 'contentEn' | 'excerptEn' | 'metaTitleEn' | 'metaDescriptionEn' | 'coverImagePublicId'> & {
    contentEn: string;
    excerptEn: string | null;
    category: { id: string; nameId: string; nameEn: string; slug: string } | null;
    author: { id: string; name: string; image: string | null } | null;
  } | null);

  if (!post || !post.isPublished) {
    notFound();
  }

  const title = isEn && post.titleEn ? post.titleEn : post.titleId;
  const excerpt = isEn && post.excerptEn ? post.excerptEn : post.excerptId;
  const content = isEn && post.contentEn ? post.contentEn : post.contentId;
  const categoryName = post.category
    ? isEn && post.category.nameEn
      ? post.category.nameEn
      : post.category.nameId
    : null;
  const readingMinutes = estimateReadingTime(content || '');
  const coverImage = getBlogCoverImage(post.coverImageUrl, post.slug);

  // Record view asynchronously (non-blocking; failures log inside the service)
  void recordBlogView({ blogPostId: post.id });

  // Centralized rich-text policy (lib/utils/sanitize-html.ts) — same policy
  // applied at write-time in app/api/admin/blog/*, so defence in depth.
  const sanitizedContent = sanitizeRichText(content);

  const pageUrl = `https://dapurdekaka.com/blog/${slug}`;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://dapurdekaka.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: 'https://dapurdekaka.com/blog',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: title,
        item: pageUrl,
      },
    ],
  };

  // Fetch related posts — exclude current, same category preferred, limit to 3
  const relatedPosts = await db.query.blogPosts.findMany({
    where: and(
      eq(blogPosts.isPublished, true),
      ne(blogPosts.id, post.id),
      isNull(blogPosts.deletedAt),
      post.category ? eq(blogPosts.blogCategoryId, post.category.id) : undefined,
    ),
    orderBy: [desc(blogPosts.publishedAt)],
    limit: 3,
    with: { category: true },
  });

  const filteredRelated = relatedPosts.slice(0, 3);

  return (
    <>
      <ReadingProgress />
      <BackToTop />
      <div className="bg-brand-cream min-h-screen">
        <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
          />

          <Link
            href="/blog"
            className="mb-6 inline-flex h-10 items-center gap-2 rounded-button border border-brand-cream-dark bg-white px-4 text-sm font-medium text-text-primary transition-colors hover:border-brand-red hover:text-brand-red"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('backToBlog')}
          </Link>

          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="mb-6 text-sm">
            <ol className="flex flex-wrap items-center gap-1.5 text-text-secondary">
              <li>
                <Link href="/" className="hover:text-brand-red transition-colors">
                  Beranda
                </Link>
              </li>
              <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
              <li>
                <Link href="/blog" className="hover:text-brand-red transition-colors">
                  Blog
                </Link>
              </li>
              {post.category && categoryName && (
                <>
                  <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
                  <li>
                    <Link
                      href={`/blog?category=${post.category.slug}`}
                      className="hover:text-brand-red transition-colors"
                    >
                      {categoryName}
                    </Link>
                  </li>
                </>
              )}
              <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
              <li className="text-text-primary font-medium truncate max-w-[200px] md:max-w-md" aria-current="page">
                {title}
              </li>
            </ol>
          </nav>

          <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_260px] xl:gap-10 items-start">
            <article className="min-w-0 rounded-2xl border border-brand-cream-dark bg-white p-5 shadow-card md:p-8">
              <header className="mb-6">
                {categoryName && (
                  <span className="inline-flex items-center px-3 py-1 bg-brand-red/10 text-brand-red text-sm font-semibold rounded-full mb-4">
                    {categoryName}
                  </span>
                )}
                <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight text-text-primary mb-3">
                  {title}
                </h1>
                {excerpt && (
                  <p className="text-lg leading-relaxed text-text-secondary">
                    {excerpt}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    <time dateTime={post.publishedAt?.toISOString()}>
                      {post.publishedAt ? formatBlogDate(post.publishedAt, locale) : 'Draft'}
                    </time>
                  </span>
                  <span aria-hidden="true" className="text-brand-cream-dark">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    {t('readTime', { minutes: readingMinutes })}
                  </span>
                  {post.author && (
                    <>
                      <span aria-hidden="true" className="text-brand-cream-dark">•</span>
                      <span className="inline-flex items-center gap-2">
                        {post.author.image ? (
                          <span className="relative block h-6 w-6 overflow-hidden rounded-full">
                            <Image
                              src={post.author.image}
                              alt={post.author.name}
                              fill
                              className="object-cover"
                            />
                          </span>
                        ) : (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-red text-[11px] font-bold text-white" aria-hidden="true">
                            {post.author.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        {post.author.name}
                      </span>
                    </>
                  )}
                </div>
              </header>

              <div className="relative mb-8 aspect-[16/9] w-full overflow-hidden rounded-xl bg-brand-cream">
                <Image
                  src={coverImage}
                  alt={title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 800px"
                  priority
                />
              </div>

              <div
                className="prose prose-lg max-w-none prose-headings:font-display prose-headings:font-bold prose-headings:text-text-primary prose-p:leading-relaxed prose-p:text-text-primary/80 prose-a:font-medium prose-a:text-brand-red hover:prose-a:text-brand-red-dark prose-strong:text-text-primary prose-li:text-text-primary/80 prose-img:rounded-xl prose-blockquote:border-l-4 prose-blockquote:border-brand-red prose-blockquote:bg-brand-cream/60 prose-blockquote:px-4 prose-blockquote:py-1 prose-blockquote:not-italic"
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              />

              {/* CTA after content */}
              <BlogCTA />

              {/* Author Bio */}
              {post.author && (
                <div className="mt-8 border-t border-brand-cream-dark pt-6">
                  <div className="flex items-start gap-4 rounded-xl bg-brand-cream p-4">
                    {post.author.image ? (
                      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full">
                        <Image
                          src={post.author.image}
                          alt={post.author.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-brand-red">
                        <span className="text-lg font-bold text-white">
                          {post.author.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-xs text-text-secondary">{t('writtenBy')}</p>
                      <p className="font-semibold text-text-primary">{post.author.name}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Share Buttons */}
              <div className="mt-8 border-t border-brand-cream-dark pt-6">
                <p className="mb-3 text-sm font-medium text-text-secondary">{t('shareArticle')}</p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${title} - ${pageUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center gap-2 rounded-button bg-whatsapp-green px-4 text-sm font-semibold text-white transition-colors hover:bg-whatsapp-green-dark"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
                  </a>
                  <CopyLinkButton url={pageUrl} />
                </div>
              </div>
            </article>

            {/* Sticky Table of Contents */}
            <aside className="hidden xl:block">
              <div className="sticky top-24 rounded-2xl border border-brand-cream-dark bg-white p-5 shadow-card">
                <TableOfContents contentHtml={content} />
              </div>
            </aside>
          </div>

          {/* Related Posts */}
          {filteredRelated.length > 0 && (
            <section aria-label={t('relatedArticles')} className="mt-10 border-t border-brand-cream-dark pt-8">
              <div className="mb-6 flex items-end justify-between gap-4">
                <h2 className="font-display text-xl md:text-2xl font-bold text-text-primary">{t('relatedArticles')}</h2>
                <Link href="/blog" className="shrink-0 text-sm font-semibold text-brand-red hover:text-brand-red-dark hover:underline">
                  {t('viewAllArticles')}
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredRelated.map((related) => (
                  <BlogCard
                    key={related.id}
                    locale={locale}
                    post={related as Parameters<typeof BlogCard>[0]['post']}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
