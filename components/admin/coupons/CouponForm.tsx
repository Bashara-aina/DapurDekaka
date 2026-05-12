'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface CouponFormProps {
  initialData?: {
    id?: string;
    code?: string;
    type?: 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y';
    nameId?: string;
    nameEn?: string;
    descriptionId?: string;
    descriptionEn?: string;
    discountValue?: number;
    minOrderAmount?: number;
    maxDiscountAmount?: number;
    freeShipping?: boolean;
    buyQuantity?: number;
    getQuantity?: number;
    maxUses?: number;
    maxUsesPerUser?: number;
    isActive?: boolean;
    isPublic?: boolean;
    startsAt?: string;
    expiresAt?: string;
  };
  onSubmit: (data: CouponFormData) => Promise<void>;
  isSubmitting?: boolean;
}

const COUPON_TYPES = [
  { value: 'percentage', label: 'Persentase' },
  { value: 'fixed', label: 'Fixed Amount' },
  { value: 'free_shipping', label: 'Gratis Ongkir' },
  { value: 'buy_x_get_y', label: 'Buy X Get Y' },
] as const;

const CouponSchema = z.object({
  code: z.string().min(1, 'Kode kupon wajib diisi').max(50),
  type: z.enum(['percentage', 'fixed', 'free_shipping', 'buy_x_get_y']),
  nameId: z.string().min(1, 'Nama ID wajib diisi').max(255),
  nameEn: z.string().min(1, 'Nama EN wajib diisi').max(255),
  descriptionId: z.string().optional(),
  descriptionEn: z.string().optional(),
  discountValue: z.number().int().nonnegative().optional(),
  minOrderAmount: z.number().int().nonnegative().default(0),
  maxDiscountAmount: z.number().int().nonnegative().optional().nullable(),
  freeShipping: z.boolean().default(false),
  buyQuantity: z.number().int().nonnegative().optional(),
  getQuantity: z.number().int().nonnegative().optional(),
  maxUses: z.number().int().nonnegative().optional().nullable(),
  maxUsesPerUser: z.number().int().nonnegative().optional().nullable(),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(false),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export type CouponFormData = z.infer<typeof CouponSchema>;

export function CouponForm({ initialData, onSubmit, isSubmitting }: CouponFormProps) {
  const form = useForm<CouponFormData>({
    resolver: zodResolver(CouponSchema),
    defaultValues: {
      code: initialData?.code ?? '',
      type: initialData?.type ?? 'percentage',
      nameId: initialData?.nameId ?? '',
      nameEn: initialData?.nameEn ?? '',
      descriptionId: initialData?.descriptionId ?? '',
      descriptionEn: initialData?.descriptionEn ?? '',
      discountValue: initialData?.discountValue ?? 0,
      minOrderAmount: initialData?.minOrderAmount ?? 0,
      maxDiscountAmount: initialData?.maxDiscountAmount ?? null,
      freeShipping: initialData?.freeShipping ?? false,
      buyQuantity: initialData?.buyQuantity ?? undefined,
      getQuantity: initialData?.getQuantity ?? undefined,
      maxUses: initialData?.maxUses ?? null,
      maxUsesPerUser: initialData?.maxUsesPerUser ?? null,
      isActive: initialData?.isActive ?? true,
      isPublic: initialData?.isPublic ?? false,
      startsAt: initialData?.startsAt ?? null,
      expiresAt: initialData?.expiresAt ?? null,
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="code">Kode Kupon</Label>
          <Input
            id="code"
            {...form.register('code')}
            placeholder="MISAL10"
            className="uppercase"
          />
          {form.formState.errors.code && (
            <p className="text-sm text-red-500">{form.formState.errors.code.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Tipe Kupon</Label>
          <select
            id="type"
            {...form.register('type')}
            className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm"
          >
            {COUPON_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nameId">Nama (Bahasa Indonesia)</Label>
          <Input id="nameId" {...form.register('nameId')} placeholder="Diskon 10%" />
          {form.formState.errors.nameId && (
            <p className="text-sm text-red-500">{form.formState.errors.nameId.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="nameEn">Nama (English)</Label>
          <Input id="nameEn" {...form.register('nameEn')} placeholder="10% Off" />
          {form.formState.errors.nameEn && (
            <p className="text-sm text-red-500">{form.formState.errors.nameEn.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="discountValue">Nilai Diskon</Label>
          <Input
            id="discountValue"
            type="number"
            {...form.register('discountValue', { valueAsNumber: true })}
            placeholder="10"
          />
          {form.formState.errors.discountValue && (
            <p className="text-sm text-red-500">{form.formState.errors.discountValue.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="minOrderAmount">Minimal Belanja (IDR)</Label>
          <Input
            id="minOrderAmount"
            type="number"
            {...form.register('minOrderAmount', { valueAsNumber: true })}
            placeholder="50000"
          />
          {form.formState.errors.minOrderAmount && (
            <p className="text-sm text-red-500">{form.formState.errors.minOrderAmount.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxDiscountAmount">Diskon Maksimal (IDR, opsional)</Label>
          <Input
            id="maxDiscountAmount"
            type="number"
            {...form.register('maxDiscountAmount', { valueAsNumber: true })}
            placeholder="20000"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxUses">Total Penggunaan Maksimal (opsional)</Label>
          <Input
            id="maxUses"
            type="number"
            {...form.register('maxUses', { valueAsNumber: true })}
            placeholder="1000"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxUsesPerUser">Max Penggunaan per User (opsional)</Label>
          <Input
            id="maxUsesPerUser"
            type="number"
            {...form.register('maxUsesPerUser', { valueAsNumber: true })}
            placeholder="1"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="startsAt">Tanggal Mulai (opsional)</Label>
          <Input id="startsAt" type="datetime-local" {...form.register('startsAt')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expiresAt">Tanggal Kadaluarsa (opsional)</Label>
          <Input id="expiresAt" type="datetime-local" {...form.register('expiresAt')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descriptionId">Deskripsi (ID)</Label>
        <textarea
          id="descriptionId"
          {...form.register('descriptionId')}
          className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-white text-sm"
          placeholder="Diskon 10% untuk pembelian pertama"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descriptionEn">Description (EN)</Label>
        <textarea
          id="descriptionEn"
          {...form.register('descriptionEn')}
          className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-white text-sm"
          placeholder="10% off for first purchase"
        />
      </div>

      {form.watch('type') === 'buy_x_get_y' && (
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="buyQuantity">Beli (X)</Label>
            <Input
              id="buyQuantity"
              type="number"
              {...form.register('buyQuantity', { valueAsNumber: true })}
              placeholder="2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="getQuantity">Gratis (Y)</Label>
            <Input
              id="getQuantity"
              type="number"
              {...form.register('getQuantity', { valueAsNumber: true })}
              placeholder="1"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-8">
        <div className="flex items-center space-y-2">
          <Switch
            id="isActive"
            checked={form.watch('isActive')}
            onCheckedChange={(checked) => form.setValue('isActive', checked)}
          />
          <Label htmlFor="isActive">Aktif</Label>
        </div>

        <div className="flex items-center space-y-2">
          <Switch
            id="isPublic"
            checked={form.watch('isPublic')}
            onCheckedChange={(checked) => form.setValue('isPublic', checked)}
          />
          <Label htmlFor="isPublic">Tampilkan di halaman customer</Label>
        </div>

        <div className="flex items-center space-y-2">
          <Switch
            id="freeShipping"
            checked={form.watch('freeShipping')}
            onCheckedChange={(checked) => form.setValue('freeShipping', checked)}
          />
          <Label htmlFor="freeShipping">Gratis Ongkir</Label>
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan...' : initialData?.id ? 'Update Kupon' : 'Buat Kupon'}
        </Button>
      </div>
    </form>
  );
}