'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import type { CarouselSlide } from '@/lib/db/schema';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  slides: CarouselSlide[];
}

export default function CarouselGridClient({ slides }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [targetDelete, setTargetDelete] = useState<CarouselSlide | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/carousel/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-carousel-slides'] });
      toast.success('Slide dihapus');
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Carousel</h1>
        <Link
          href="/admin/carousel/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-lg hover:bg-brand-red-dark transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Buat Slide
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {slides.map((slide) => {
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
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm truncate">{slide.titleId}</h3>
                    <p className="text-xs text-gray-500 truncate">{slide.titleEn}</p>
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
                <div className="flex items-center gap-2 mt-2">
                  <Link
                    href={`/admin/carousel/${slide.id}`}
                    className="flex-1 text-center px-3 py-2 border border-brand-red text-brand-red rounded-lg hover:bg-brand-red hover:text-white transition-colors text-sm font-medium"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setTargetDelete(slide); setShowDeleteDialog(true); }}
                    disabled={deleteMutation.isPending}
                    className="p-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    aria-label="Hapus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {slides.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            Belum ada slide
          </div>
        )}
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Slide?</DialogTitle>
            <DialogDescription>
              Slide &quot;{targetDelete?.titleId}&quot; akan dihapus. Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3">
            <button
              type="button"
              onClick={() => { setShowDeleteDialog(false); setTargetDelete(null); }}
              className="flex-1 h-10 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                if (targetDelete) deleteMutation.mutate(targetDelete.id);
                setShowDeleteDialog(false);
                setTargetDelete(null);
              }}
              disabled={deleteMutation.isPending}
              className="flex-1 h-10 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Hapus
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}