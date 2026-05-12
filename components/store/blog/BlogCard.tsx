import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import type { BlogPost } from '@/lib/db/schema';
import { formatWIB } from '@/lib/utils/format-date';

interface BlogCardProps {
  post: BlogPost;
}

export function BlogCard({ post }: BlogCardProps) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <Card className="group overflow-hidden hover:shadow-lg transition-shadow duration-200">
        {post.coverImageUrl && (
          <div className="aspect-[16/9] relative overflow-hidden bg-brand-cream">
            <Image
              src={post.coverImageUrl}
              alt={post.titleId}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        )}
        <div className="p-4 space-y-2">
          <p className="text-xs text-text-secondary">
            {post.publishedAt ? formatWIB(new Date(post.publishedAt)) : 'Draft'}
          </p>
          <h3 className="font-display font-semibold text-lg line-clamp-2 group-hover:text-brand-red transition-colors">
            {post.titleId}
          </h3>
          {post.excerptId && (
            <p className="text-sm text-text-secondary line-clamp-2">
              {post.excerptId}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}