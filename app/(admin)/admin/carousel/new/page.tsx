'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CarouselForm, type CarouselFormData } from '@/components/admin/carousel/CarouselForm';

export default function AdminCarouselNewPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(data: CarouselFormData) {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/carousel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          startsAt: data.startsAt ?? null,
          endsAt: data.endsAt ?? null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create slide');
      }

      router.push('/admin/carousel');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create slide');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/carousel" className="p-2 hover:bg-admin-content rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Buat Slide Baru</h1>
      </div>

      <div className="bg-white rounded-lg border border-admin-border p-6">
        <CarouselForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </div>
    </div>
  );
}