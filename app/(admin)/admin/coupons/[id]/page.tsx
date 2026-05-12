'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CouponForm, type CouponFormData } from '@/components/admin/coupons/CouponForm';
import type { Coupon } from '@/lib/db/schema';

type Props = { params: Promise<{ id: string }> };

export default function AdminCouponEditPage({ params }: Props) {
  const [couponId, setCouponId] = useState<string>('');
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    params.then(p => {
      setCouponId(p.id);
      setIsClientReady(true);
    });
  }, [params]);

  if (!isClientReady) {
    return <div className="p-6">Loading...</div>;
  }

  return <AdminCouponEditClient couponId={couponId} />;
}

function AdminCouponEditClient({ couponId }: { couponId: string }) {
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
      } catch (error) {
        alert('Failed to load coupon');
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
        throw new Error(error.error || 'Failed to update coupon');
      }

      router.push('/admin/coupons');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update coupon');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!coupon) {
    return <div className="p-6">Kupon tidak ditemukan</div>;
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