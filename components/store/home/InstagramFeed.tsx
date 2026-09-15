'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
const CLOUDINARY_BASE = CLOUD_NAME
  ? `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_webp,q_auto,w_600`
  : '';

export interface GalleryPost {
  id: string;
  publicId: string;
  alt: string;
}

interface InstagramFeedProps {
  images?: GalleryPost[];
  instagramUrl?: string;
}

const FALLBACK: GalleryPost[] = [];

export function InstagramFeed({ images, instagramUrl }: InstagramFeedProps) {
  const t = useTranslations();
  const posts = images && images.length > 0 ? images : FALLBACK;
  if (posts.length === 0) return null;
  const igUrl = instagramUrl || process.env.NEXT_PUBLIC_INSTAGRAM_URL || '';

  return (
    <section className="py-12 px-4 bg-brand-cream">
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <h2 className="font-display text-xl md:text-2xl font-semibold mb-2">
            {t('home.gallery.title')}
          </h2>
          <p className="text-text-secondary text-sm">{t('home.gallery.description')}</p>
          {igUrl ? (
            <a
              href={igUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 text-sm text-brand-red hover:underline"
            >
              {t('home.gallery.followOnInstagram')}
            </a>
          ) : null}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
          {posts.map((post) => (
            <a
              key={post.id}
              href={igUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="aspect-square relative rounded-lg overflow-hidden bg-brand-cream-dark group"
            >
              {CLOUDINARY_BASE ? (
                <Image
                  src={`${CLOUDINARY_BASE}/${post.publicId}`}
                  alt={post.alt}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              ) : null}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
