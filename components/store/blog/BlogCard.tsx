import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import type { BlogPost } from '@/lib/db/schema';
import { formatWIB } from '@/lib/utils/format-date';
import { getReadingTime } from '@/lib/utils/reading-time';

interface BlogCardProps {
  post: BlogPost & { category?: { nameId: string; id: string } | null };
}

export function BlogCard({ post }: BlogCardProps) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <Card className="group overflow-hidden hover:shadow-card-hover transition-all duration-200 h-full flex flex-col">
        <div className="aspect-[16/9] relative overflow-hidden bg-brand-cream flex-shrink-0">
          {post.coverImageUrl ? (
            <Image
              src={post.coverImageUrl}
              alt={post.titleId}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 400px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-cream to-brand-cream-dark">
              <span className="text-4xl">🥟</span>
            </div>
          )}
        </div>
        <div className="p-4 space-y-2 flex-1 flex flex-col">
          {/* Category badge */}
          {post.category && (
            <span className="inline-block self-start px-2 py-0.5 bg-brand-red/10 text-brand-red text-xs font-medium rounded-full">
              {post.category.nameId}
            </span>
          )}
          <h3 className="font-display font-semibold text-lg line-clamp-2 group-hover:text-brand-red transition-colors flex-1">
            {post.titleId}
          </h3>
          {post.excerptId && (
            <p className="text-sm text-text-secondary line-clamp-2">
              {post.excerptId}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-text-secondary pt-1 mt-auto">
            <span>{post.publishedAt ? formatWIB(new Date(post.publishedAt)) : 'Draft'}</span>
            <span>·</span>
            <span>{getReadingTime(post.contentId)} mnt baca</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}