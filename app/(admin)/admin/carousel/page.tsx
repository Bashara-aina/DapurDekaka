import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db';
import { carouselSlides } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function AdminCarouselPage() {
  const allSlides = await db.query.carouselSlides.findMany({
    orderBy: [carouselSlides.sortOrder],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Carousel</h1>
        <Link
          href="/admin/carousel/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-lg hover:bg-brand-red-dark transition-colors text-sm font-medium"
        >
          + Buat Slide
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allSlides.map((slide) => {
          const isExpired = slide.endsAt && new Date(slide.endsAt) < new Date();
          const isNotStarted = slide.startsAt && new Date(slide.startsAt) > new Date();
          
          return (
            <div key={slide.id} className="bg-white rounded-lg border border-admin-border overflow-hidden">
              <div className="aspect-[16/9] relative bg-brand-cream">
                {slide.imageUrl && (
                  <Image
                    src={slide.imageUrl}
                    alt={slide.titleId}
                    fill
                    className="object-cover"
                  />
                )}
                {slide.badgeText && (
                  <div className="absolute top-2 left-2 bg-brand-red text-white text-xs px-2 py-1 rounded font-medium">
                    {slide.badgeText}
                  </div>
                )}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-sm">{slide.titleId}</h3>
                    <p className="text-xs text-gray-500">{slide.titleEn}</p>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                    !slide.isActive
                      ? 'bg-gray-100 text-gray-800'
                      : isExpired
                      ? 'bg-red-100 text-red-800'
                      : isNotStarted
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {slide.type}
                  </span>
                </div>
                <Link
                  href={`/admin/carousel/${slide.id}`}
                  className="block w-full text-center px-3 py-2 border border-brand-red text-brand-red rounded-lg hover:bg-brand-red hover:text-white transition-colors text-sm font-medium mt-2"
                >
                  Edit
                </Link>
              </div>
            </div>
          );
        })}
        {allSlides.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            Belum ada slide
          </div>
        )}
      </div>
    </div>
  );
}