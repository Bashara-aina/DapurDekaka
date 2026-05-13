'use client';

import Image from 'next/image';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dsnhwfuxh';
const CLOUDINARY_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_webp,q_auto,w_600`;

const instagramPosts = [
  { id: 1, cloudinaryPublicId: 'dapurdekaka/gallery/gallery-01', alt: 'Dimsum premium' },
  { id: 2, cloudinaryPublicId: 'dapurdekaka/gallery/gallery-02', alt: 'Bakso frozen' },
  { id: 3, cloudinaryPublicId: 'dapurdekaka/gallery/gallery-03', alt: 'Siomay Bandung' },
  { id: 4, cloudinaryPublicId: 'dapurdekaka/gallery/gallery-04', alt: 'Lumpia crispy' },
  { id: 5, cloudinaryPublicId: 'dapurdekaka/gallery/gallery-05', alt: 'Pangsit ayam' },
  { id: 6, cloudinaryPublicId: 'dapurdekaka/gallery/gallery-06', alt: 'Menu catering' },
];

export function InstagramFeed() {
  return (
    <section className="py-12 px-4 bg-brand-cream">
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <h2 className="font-display text-xl md:text-2xl font-semibold mb-2">
            Ikuti Kami di Instagram
          </h2>
          <p className="text-text-secondary text-sm">@dapurdekaka</p>
        </div>

        {/* Mobile: 2 col grid, Desktop: 6 col grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
          {instagramPosts.map((post) => (
            <a
              key={post.id}
              href="https://instagram.com/dapurdekaka"
              target="_blank"
              rel="noopener noreferrer"
              className="aspect-square relative rounded-lg overflow-hidden bg-brand-cream-dark group"
            >
              <Image
                src={`${CLOUDINARY_BASE}/${post.cloudinaryPublicId}`}
                alt={post.alt}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 768px) 50vw, 16vw"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-2xl">
                  📷
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}