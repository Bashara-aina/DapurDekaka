'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CouponForm, type CouponFormData } from '@/components/admin/coupons/CouponForm';

export default function AdminCouponNewPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(data: CouponFormData) {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
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
        throw new Error(error.error || 'Failed to create coupon');
      }

      router.push('/admin/coupons');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create coupon');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/coupons" className="p-2 hover:bg-admin-content rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Buat Kupon Baru</h1>
      </div>

      <div className="bg-white rounded-lg border border-admin-border p-6">
        <CouponForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </div>
    </div>
  );
}