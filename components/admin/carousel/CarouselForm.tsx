'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

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
    </form>
  );
}