import Link from 'next/link';
import Image from 'next/image';
import { CalendarDays, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { BlogPost } from '@/lib/db/schema';
import { formatBlogDate } from '@/lib/utils/format-date';
import { getReadingTime } from '@/lib/utils/reading-time';
import { getBlogCoverImage } from '@/lib/utils/blog-fallback-image';

interface BlogCardProps {
  post: BlogPost & {
    category?: { nameId: string; nameEn?: string | null; id: string } | null;
  };
  locale?: string;
}

export function BlogCard({ post, locale = 'id' }: BlogCardProps) {
  const isEn = locale === 'en';
  const title = isEn && post.titleEn ? post.titleEn : post.titleId;
  const excerpt = isEn && post.excerptEn ? post.excerptEn : post.excerptId;
  const categoryName =
    post.category != null
      ? isEn && post.category.nameEn
        ? post.category.nameEn
        : post.category.nameId
      : null;
  const imageUrl = getBlogCoverImage(post.coverImageUrl, post.slug || post.id);
  const minutes = getReadingTime(post.contentId || post.contentEn || '');

  return (
    <article className="h-full">
      <Link
        href={`/blog/${post.slug}`}
        className="group block h-full rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2"
        aria-label={title}
      >
        <Card className="h-full flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
          <div className="aspect-[16/10] relative overflow-hidden bg-brand-cream flex-shrink-0">
            <Image
              src={imageUrl}
              alt={title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 400px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" aria-hidden="true" />
          </div>
          <div className="p-5 flex flex-1 flex-col">
            {categoryName && (
              <span className="inline-flex self-start items-center px-2.5 py-1 bg-brand-red/10 text-brand-red text-xs font-semibold rounded-full mb-2.5">
                {categoryName}
              </span>
            )}
            <h3 className="font-display font-semibold text-lg leading-snug line-clamp-2 group-hover:text-brand-red transition-colors">
              {title}
            </h3>
            {excerpt && (
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary line-clamp-2">
                {excerpt}
              </p>
            )}
            <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                <time dateTime={post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined}>
                  {post.publishedAt ? formatBlogDate(post.publishedAt, locale) : 'Draft'}
                </time>
              </span>
              <span aria-hidden="true" className="text-brand-cream-dark">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {minutes} {isEn ? 'min read' : 'mnt baca'}
              </span>
            </div>
          </div>
        </Card>
      </Link>
    </article>
  );
}