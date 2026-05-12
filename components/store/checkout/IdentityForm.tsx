'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';

const identitySchema = z.object({
  recipientName: z.string().min(2, 'Nama minimal 2 karakter'),
  recipientEmail: z.string().email('Format email tidak valid'),
  recipientPhone: z
    .string()
    .min(8, 'Nomor HP minimal 8 digit')
    .regex(/^(\+62|62|0)[0-9]{8,13}$/, 'Format nomor HP tidak valid (contoh: 08123456789)'),
});

export type IdentityFormData = z.infer<typeof identitySchema>;

interface IdentityFormProps {
  defaultValues?: Partial<IdentityFormData>;
  onSubmit: (data: IdentityFormData) => void;
  onBack?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function IdentityForm({
  defaultValues,
  onSubmit,
  onBack,
  isLoading,
  className,
}: IdentityFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IdentityFormData>({
    resolver: zodResolver(identitySchema),
    defaultValues,
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn('bg-white rounded-card p-6 shadow-card', className)}
    >
      <h2 className="font-semibold text-lg mb-4">Data Diri</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nama Lengkap</label>
          <Input
            {...register('recipientName')}
            placeholder="Masukkan nama lengkap"
            error={errors.recipientName?.message}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <Input
            {...register('recipientEmail')}
            type="email"
            placeholder="email@contoh.com"
            error={errors.recipientEmail?.message}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">No. HP / WhatsApp</label>
          <Input
            {...register('recipientPhone')}
            type="tel"
            placeholder="081234567890"
            error={errors.recipientPhone?.message}
          />
          <p className="text-xs text-text-secondary mt-1">
            Contoh: 081234567890 atau +6281234567890
          </p>
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">
            Kembali
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={isLoading}>
          Lanjut ke Pengiriman
        </Button>
      </div>
    </form>
  );
}