import type { Metadata } from 'next';
import Image from 'next/image';
import DOMPurify from 'isomorphic-dompurify';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

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
    category: { nameId: string } | null;
  } | null);

  if (!post || !post.isPublished) {
    notFound();
  }

  const sanitizedContent = DOMPurify.sanitize(post.contentId || '', {
    ALLOWED_TAGS: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
  });

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
      </article>
    </div>
  );
}