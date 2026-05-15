import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import DOMPurify from 'isomorphic-dompurify';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { BlogCard } from '@/components/store/blog/BlogCard';
import { Copy, Share2 } from 'lucide-react';

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
    robots: {
      index: true,
      follow: true,
    },
  };
}

export const revalidate = 86400;

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;

  const post = await db.query.blogPosts.findFirst({
    where: eq(blogPosts.slug, slug),
    with: {
      category: true,
    },
  }) as ({
    id: string;
    titleId: string;
    titleEn: string;
    slug: string;
    excerptId: string | null;
    contentId: string;
    metaTitleId: string | null;
    metaDescriptionId: string | null;
    publishedAt: Date | null;
    coverImageUrl: string | null;
    isPublished: boolean;
    category: { id: string; nameId: string } | null;
  } | null);

  if (!post || !post.isPublished) {
    notFound();
  }

  const sanitizedContent = DOMPurify.sanitize(post.contentId || '', {
    ALLOWED_TAGS: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
  });

  const pageUrl = `https://dapurdekaka.com/blog/${slug}`;

  // Fetch related posts (same category, excluding current)
  const relatedPosts = post.category
    ? await db.query.blogPosts.findMany({
        where: eq(blogPosts.blogCategoryId, post.category.id),
        orderBy: [desc(blogPosts.publishedAt)],
        limit: 3,
      })
    : await db.query.blogPosts.findMany({
        where: eq(blogPosts.isPublished, true),
        orderBy: [desc(blogPosts.publishedAt)],
        limit: 3,
      });

  const filteredRelated = relatedPosts
    .filter(p => p.slug !== slug)
    .slice(0, 3);

  return (
    <div className="container py-8 md:py-12 pb-20 md:pb-12">
      <article>
        {post.coverImageUrl && (
          <div className="relative w-full h-64 md:h-96 mb-8 rounded-xl overflow-hidden">
            <Image
              src={post.coverImageUrl}
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
        </header>

        <div
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />

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
  );
}

// Client component for copy link button
function CopyLinkButton({ url }: { url: string }) {
  return (
    <button
      onClick={() => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(url).then(() => {
            // Could add toast notification here
          }).catch(() => {
            // Fallback: select text
          });
        }
      }}
      className="inline-flex items-center gap-2 px-4 py-2 bg-brand-cream-dark text-text-primary text-sm font-medium rounded-button hover:bg-brand-cream transition-colors"
    >
      <Copy className="w-4 h-4" /> Salin Link
    </button>
  );
}