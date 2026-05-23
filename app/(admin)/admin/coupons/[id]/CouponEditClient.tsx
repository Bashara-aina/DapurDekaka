'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { CouponForm, type CouponFormData } from '@/components/admin/coupons/CouponForm';
import type { Coupon } from '@/lib/db/schema';

interface CouponEditClientProps {
  couponId: string;
}

export default function CouponEditClient({ couponId }: CouponEditClientProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCoupon() {
      try {
        const response = await fetch(`/api/admin/coupons/${couponId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch coupon');
        }
        const result = await response.json();
        setCoupon(result.data);
      } catch {
        toast.error('Gagal memuat data kupon');
        router.push('/admin/coupons');
      } finally {
        setLoading(false);
      }
    }
    fetchCoupon();
  }, [couponId, router]);

  async function handleSubmit(data: CouponFormData) {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/coupons/${couponId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          maxUses: data.maxUses ?? null,
          maxUsesPerUser: data.maxUsesPerUser ?? null,
          maxDiscountAmount: data.maxDiscountAmount ?? null,
          buyQuantity: data.buyQuantity ?? null,
          getQuantity: data.getQuantity ?? null,
          startsAt: data.startsAt ?? null,
          expiresAt: data.expiresAt ?? null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Gagal mengupdate kupon');
      }

      router.push('/admin/coupons');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengupdate kupon');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="bg-white rounded-lg border border-admin-border p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    );
  }

  if (!coupon) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/coupons" className="p-2 hover:bg-admin-content rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">Edit Kupon</h1>
        </div>
        <div className="bg-white rounded-lg border border-admin-border p-6 text-center text-red-500">
          Kupon tidak ditemukan
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/coupons" className="p-2 hover:bg-admin-content rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Edit Kupon</h1>
      </div>

      <div className="bg-white rounded-lg border border-admin-border p-6">
        <CouponForm
          initialData={{
            id: coupon.id,
            code: coupon.code,
            type: coupon.type as 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y',
            nameId: coupon.nameId,
            nameEn: coupon.nameEn,
            descriptionId: coupon.descriptionId ?? undefined,
            descriptionEn: coupon.descriptionEn ?? undefined,
            discountValue: coupon.discountValue ?? undefined,
            minOrderAmount: coupon.minOrderAmount,
            maxDiscountAmount: coupon.maxDiscountAmount ?? undefined,
            freeShipping: coupon.freeShipping,
            buyQuantity: coupon.buyQuantity ?? undefined,
            getQuantity: coupon.getQuantity ?? undefined,
            maxUses: coupon.maxUses ?? undefined,
            maxUsesPerUser: coupon.maxUsesPerUser ?? undefined,
            isActive: coupon.isActive,
            isPublic: coupon.isPublic,
            startsAt: coupon.startsAt ? new Date(coupon.startsAt).toISOString().slice(0, 16) : undefined,
            expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 16) : undefined,
          }}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}