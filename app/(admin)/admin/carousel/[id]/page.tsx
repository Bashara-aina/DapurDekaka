'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CarouselForm, type CarouselFormData } from '@/components/admin/carousel/CarouselForm';
import type { CarouselSlide } from '@/lib/db/schema';

type Props = { params: Promise<{ id: string }> };

export default function AdminCarouselEditPage({ params }: Props) {
  const [slideId, setSlideId] = useState<string>('');
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    params.then(p => {
      setSlideId(p.id);
      setIsClientReady(true);
    });
  }, [params]);

  if (!isClientReady) {
    return <div className="p-6">Loading...</div>;
  }

  return <AdminCarouselEditClient slideId={slideId} />;
}

function AdminCarouselEditClient({ slideId }: { slideId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slide, setSlide] = useState<CarouselSlide | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSlide() {
      try {
        const response = await fetch(`/api/admin/carousel/${slideId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch slide');
        }
        const result = await response.json();
        setSlide(result.data);
      } catch (error) {
        alert('Failed to load slide');
        router.push('/admin/carousel');
      } finally {
        setLoading(false);
      }
    }
    fetchSlide();
  }, [slideId, router]);

  async function handleSubmit(data: CarouselFormData) {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/carousel/${slideId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          startsAt: data.startsAt ?? null,
          endsAt: data.endsAt ?? null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update slide');
      }

      router.push('/admin/carousel');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update slide');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!slide) {
    return <div className="p-6">Slide tidak ditemukan</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/carousel" className="p-2 hover:bg-admin-content rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Edit Slide</h1>
      </div>

      <div className="bg-white rounded-lg border border-admin-border p-6">
        <CarouselForm
          initialData={{
            id: slide.id,
            type: slide.type as 'product_hero' | 'promo' | 'brand_story',
            titleId: slide.titleId,
            titleEn: slide.titleEn,
            subtitleId: slide.subtitleId ?? undefined,
            subtitleEn: slide.subtitleEn ?? undefined,
            imageUrl: slide.imageUrl,
            imagePublicId: slide.imagePublicId,
            ctaLabelId: slide.ctaLabelId ?? undefined,
            ctaLabelEn: slide.ctaLabelEn ?? undefined,
            ctaUrl: slide.ctaUrl ?? undefined,
            badgeText: slide.badgeText ?? undefined,
            sortOrder: slide.sortOrder,
            isActive: slide.isActive,
            startsAt: slide.startsAt ? new Date(slide.startsAt).toISOString().slice(0, 16) : undefined,
            endsAt: slide.endsAt ? new Date(slide.endsAt).toISOString().slice(0, 16) : undefined,
          }}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}