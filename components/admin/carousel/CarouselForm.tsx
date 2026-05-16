'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Image from 'next/image';

interface CarouselFormProps {
  initialData?: {
    id?: string;
    type?: 'product_hero' | 'promo' | 'brand_story';
    titleId?: string;
    titleEn?: string;
    subtitleId?: string;
    subtitleEn?: string;
    imageUrl?: string;
    imagePublicId?: string;
    ctaLabelId?: string;
    ctaLabelEn?: string;
    ctaUrl?: string;
    badgeText?: string;
    sortOrder?: number;
    isActive?: boolean;
    startsAt?: string;
    endsAt?: string;
  };
  onSubmit: (data: CarouselFormData) => Promise<void>;
  isSubmitting?: boolean;
}

const CAROUSEL_TYPES = [
  { value: 'product_hero', label: 'Product Hero' },
  { value: 'promo', label: 'Promo' },
  { value: 'brand_story', label: 'Brand Story' },
] as const;

const CarouselSchema = z.object({
  type: z.enum(['product_hero', 'promo', 'brand_story']),
  titleId: z.string().min(1, 'Judul ID wajib diisi'),
  titleEn: z.string().min(1, 'Judul EN wajib diisi'),
  subtitleId: z.string().optional(),
  subtitleEn: z.string().optional(),
  imageUrl: z.string().min(1, 'URL gambar wajib diisi'),
  imagePublicId: z.string().min(1),
  ctaLabelId: z.string().optional(),
  ctaLabelEn: z.string().optional(),
  ctaUrl: z.string().optional(),
  badgeText: z.string().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export type CarouselFormData = z.infer<typeof CarouselSchema>;

export function CarouselForm({ initialData, onSubmit, isSubmitting }: CarouselFormProps) {
  const form = useForm<CarouselFormData>({
    resolver: zodResolver(CarouselSchema),
    defaultValues: {
      type: initialData?.type ?? 'product_hero',
      titleId: initialData?.titleId ?? '',
      titleEn: initialData?.titleEn ?? '',
      subtitleId: initialData?.subtitleId ?? '',
      subtitleEn: initialData?.subtitleEn ?? '',
      imageUrl: initialData?.imageUrl ?? '',
      imagePublicId: initialData?.imagePublicId ?? '',
      ctaLabelId: initialData?.ctaLabelId ?? '',
      ctaLabelEn: initialData?.ctaLabelEn ?? '',
      ctaUrl: initialData?.ctaUrl ?? '',
      badgeText: initialData?.badgeText ?? '',
      sortOrder: initialData?.sortOrder ?? 0,
      isActive: initialData?.isActive ?? true,
      startsAt: initialData?.startsAt ?? null,
      endsAt: initialData?.endsAt ?? null,
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="type">Tipe Slide</Label>
          <select
            id="type"
            {...form.register('type')}
            className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm"
          >
            {CAROUSEL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort Order</Label>
          <Input
            id="sortOrder"
            type="number"
            {...form.register('sortOrder', { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="titleId">Judul (Bahasa Indonesia)</Label>
          <Input id="titleId" {...form.register('titleId')} />
          {form.formState.errors.titleId && (
            <p className="text-sm text-red-500">{form.formState.errors.titleId.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="titleEn">Title (English)</Label>
          <Input id="titleEn" {...form.register('titleEn')} />
          {form.formState.errors.titleEn && (
            <p className="text-sm text-red-500">{form.formState.errors.titleEn.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="subtitleId">Subtitle (ID)</Label>
          <Input id="subtitleId" {...form.register('subtitleId')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subtitleEn">Subtitle (EN)</Label>
          <Input id="subtitleEn" {...form.register('subtitleEn')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="imageUrl">Image URL</Label>
          <Input id="imageUrl" {...form.register('imageUrl')} placeholder="https://..." />
          {form.formState.errors.imageUrl && (
            <p className="text-sm text-red-500">{form.formState.errors.imageUrl.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="badgeText">Badge Text (opsional)</Label>
          <Input id="badgeText" {...form.register('badgeText')} placeholder="DISKON 10%" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ctaLabelId">CTA Label (ID)</Label>
          <Input id="ctaLabelId" {...form.register('ctaLabelId')} placeholder="Pesan Sekarang" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ctaLabelEn">CTA Label (EN)</Label>
          <Input id="ctaLabelEn" {...form.register('ctaLabelEn')} placeholder="Order Now" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ctaUrl">CTA URL</Label>
          <Input id="ctaUrl" {...form.register('ctaUrl')} placeholder="/products" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="startsAt">Tanggal Mulai (opsional)</Label>
          <Input id="startsAt" type="datetime-local" {...form.register('startsAt')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endsAt">Tanggal Berakhir (opsional)</Label>
          <Input id="endsAt" type="datetime-local" {...form.register('endsAt')} />
        </div>
      </div>

      <div className="flex items-center space-y-2">
        <Switch
          id="isActive"
          checked={form.watch('isActive')}
          onCheckedChange={(checked) => form.setValue('isActive', checked)}
        />
        <Label htmlFor="isActive">Aktif</Label>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Menyimpan...' : initialData?.id ? 'Update Slide' : 'Buat Slide'}
      </Button>

      {/* Live Preview */}
      <div className="border border-admin-border rounded-lg overflow-hidden">
        <div className="bg-admin-content px-3 py-2 border-b border-admin-border">
          <p className="text-xs font-medium text-text-secondary">Preview — bagaimana slide akan terlihat di storefront</p>
        </div>
        <div className="relative aspect-[4/3] bg-brand-cream overflow-hidden">
          {form.watch('imageUrl') ? (
            <div className="relative w-full h-full">
              <Image
                src={form.watch('imageUrl')}
                alt="Preview"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                {form.watch('badgeText') && (
                  <span className="inline-block px-2 py-1 bg-brand-red text-white text-xs font-bold rounded mb-2">
                    {form.watch('badgeText')}
                  </span>
                )}
                <p className="text-white font-display font-bold text-lg leading-tight">
                  {form.watch('titleId') || 'Judul Slide'}
                </p>
                {form.watch('subtitleId') && (
                  <p className="text-white/80 text-sm mt-1">
                    {form.watch('subtitleId')}
                  </p>
                )}
                {form.watch('ctaLabelId') && form.watch('ctaUrl') && (
                  <span className="inline-block mt-3 px-3 py-1.5 bg-white text-brand-red text-xs font-bold rounded">
                    {form.watch('ctaLabelId')}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-text-muted text-sm">Masukkan URL gambar untuk melihat preview</p>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}