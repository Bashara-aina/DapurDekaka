import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import DOMPurify from 'isomorphic-dompurify';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq, desc, and, ne, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { recordBlogView } from '@/lib/services/blog-view.service';
import { BlogCard } from '@/components/store/blog/BlogCard';
import { ReadingProgress } from '@/components/store/blog/ReadingProgress';
import { BackToTop } from '@/components/store/blog/BackToTop';
import { TableOfContents } from '@/components/store/blog/TableOfContents';
import { BlogCTA } from '@/components/store/blog/BlogCTA';
import { CopyLinkButton } from '@/components/store/blog/CopyLinkButton';

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

export const revalidate = 86400;

export async function generateStaticParams() {
  try {
    const posts = await db.query.blogPosts.findMany({
      where: and(eq(blogPosts.isPublished, true), isNull(blogPosts.deletedAt)),
      columns: { slug: true },
    });
    return posts.map((post) => ({ slug: post.slug }));
  } catch {
    // DB unavailable at build time (no DATABASE_URL); pages render on-demand via ISR
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

  const post = await db.query.blogPosts.findFirst({
    where: eq(blogPosts.slug, slug),
    with: {
      category: true,
      author: true,
    },
  }) as (Omit<typeof blogPosts.$inferSelect, 'deletedAt' | 'updatedAt' | 'createdAt' | 'contentEn' | 'excerptEn' | 'metaTitleEn' | 'metaDescriptionEn' | 'coverImagePublicId'> & {
    category: { id: string; nameId: string; slug: string } | null;
    author: { id: string; name: string; image: string | null } | null;
  } | null);

  if (!post || !post.isPublished) {
    notFound();
  }

  const readingMinutes = estimateReadingTime(post.contentId || '');

  // Record view asynchronously (non-blocking)
  recordBlogView({ blogPostId: post.id }).catch(() => {});

  const sanitizedContent = DOMPurify.sanitize(post.contentId || '', {
    ALLOWED_TAGS: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
  });

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
        name: post.titleId,
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
      <div className="container py-8 md:py-12 pb-20 md:pb-12">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />

        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-4 text-sm">
          <ol className="flex items-center gap-1 text-text-secondary">
            <li>
              <a href="/" className="hover:text-brand-red transition-colors">
                Beranda
              </a>
            </li>
            <li className="text-text-muted">/</li>
            <li>
              <a href="/blog" className="hover:text-brand-red transition-colors">
                Blog
              </a>
            </li>
            {post.category && (
              <>
                <li className="text-text-muted">/</li>
                <li>
                  <a
                    href={`/blog?category=${post.category.slug}`}
                    className="hover:text-brand-red transition-colors"
                  >
                    {post.category.nameId}
                  </a>
                </li>
              </>
            )}
            <li className="text-text-muted">/</li>
            <li className="text-text-primary font-medium truncate max-w-[200px]" aria-current="page">
              {post.titleId}
            </li>
          </ol>
        </nav>

        <div className="xl:grid xl:grid-cols-[1fr_256px] xl:gap-8 items-start">
          <article className="min-w-0">
            {post.coverImageUrl ? (
              <div className="relative w-full h-64 md:h-96 mb-8 rounded-xl overflow-hidden">
                <Image
                  src={post.coverImageUrl}
                  alt={post.titleId}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 800px"
                />
              </div>
            ) : (
              <div className="relative w-full h-64 md:h-96 mb-8 rounded-xl overflow-hidden">
                <Image
                  src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/f_webp,q_auto,w_1600/dapurdekaka/gallery/gallery-01`}
                  alt={post.titleId}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 800px"
                />
              </div>
            )}

            <header className="mb-8">
              {post.category && (
                <span className="inline-block px-3 py-1 bg-brand-red/10 text-brand-red text-sm font-medium rounded-full mb-4">
                  {post.category.nameId}
                </span>
              )}
              <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">
                {post.titleId}
              </h1>
              {post.excerptId && (
                <p className="text-lg text-text-secondary">
                  {post.excerptId}
                </p>
              )}
              <p className="text-sm text-text-muted">{readingMinutes} menit baca</p>
            </header>

            <div
              className="prose prose-lg max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-brand-red prose-img:rounded-xl"
              dangerouslySetInnerHTML={{ __html: sanitizedContent }}
            />

            {/* CTA after content */}
            <BlogCTA />

            {/* Author Bio */}
            {post.author && (
              <div className="mt-8 pt-6 border-t border-brand-cream-dark">
                <div className="flex items-start gap-4 p-4 bg-brand-cream rounded-xl">
                  {post.author.image ? (
                    <div className="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0">
                      <Image
                        src={post.author.image}
                        alt={post.author.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-brand-red flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-white">
                        {post.author.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-muted mb-1">Ditulis oleh</p>
                    <p className="font-semibold text-text-primary">{post.author.name}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Share Buttons */}
            <div className="mt-8 pt-6 border-t border-brand-cream-dark">
              <p className="text-sm font-medium text-text-secondary mb-3">Bagikan artikel ini:</p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${post.titleId} - ${pageUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white text-sm font-medium rounded-button hover:bg-[#20BD5A] transition-colors"
                >
                  <span>💬</span> WhatsApp
                </a>
                <CopyLinkButton url={pageUrl} />
              </div>
            </div>
          </article>

          {/* Sticky Table of Contents */}
          <aside className="hidden xl:block sticky top-24">
            <TableOfContents contentHtml={post.contentId} />
          </aside>
        </div>

        {/* Related Posts */}
        {filteredRelated.length > 0 && (
          <div className="mt-12 pt-8 border-t border-brand-cream-dark">
            <h2 className="font-display text-xl font-bold mb-6">Artikel Terkait</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredRelated.map((related) => (
                <BlogCard key={related.id} post={related as Parameters<typeof BlogCard>[0]['post']} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
