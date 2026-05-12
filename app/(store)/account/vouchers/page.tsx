'use client';

import { useState, useEffect } from 'react';
import { Tag, Check } from 'lucide-react';
import { VoucherCard } from '@/components/store/account/VoucherCard';
import type { Coupon } from '@/lib/db/schema';

interface VoucherData {
  usedCoupons: (Coupon & { usedAt: Date; discountApplied: number })[];
  availableCoupons: Coupon[];
}

export default function AccountVouchersPage() {
  const [data, setData] = useState<VoucherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'available' | 'used'>('available');

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      const res = await fetch('/api/account/vouchers');
      const response = await res.json();
      if (response.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch vouchers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-card shadow-card p-6 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  const availableCount = data?.availableCoupons.length || 0;
  const usedCount = data?.usedCoupons.length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Voucher & Kupon</h1>
        <p className="text-text-secondary text-sm mt-1">Kupon dan promo untukmu</p>
      </div>

      {/* Available Vouchers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-text-primary flex items-center gap-2">
            <Tag className="w-5 h-5 text-brand-gold" />
            Voucher Tersedia
          </h2>
          <span className="px-2 py-1 bg-brand-gold/10 text-brand-gold text-xs font-medium rounded-full">
            {availableCount}
          </span>
        </div>

        {availableCount === 0 ? (
          <div className="bg-white rounded-card shadow-card p-8 text-center">
            <div className="w-16 h-16 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-4">
              <Tag className="w-8 h-8 text-text-disabled" />
            </div>
            <p className="text-text-secondary">Tidak ada voucher tersedia</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.availableCoupons.map(voucher => (
              <VoucherCard
                key={voucher.id}
                voucher={voucher}
                type="available"
              />
            ))}
          </div>
        )}
      </div>

      {/* Used Vouchers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-text-primary flex items-center gap-2">
            <Check className="w-5 h-5 text-success" />
            Voucher Terpakai
          </h2>
          <span className="px-2 py-1 bg-success-light text-success text-xs font-medium rounded-full">
            {usedCount}
          </span>
        </div>

        {usedCount === 0 ? (
          <div className="bg-white rounded-card shadow-card p-8 text-center">
            <div className="w-16 h-16 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-text-disabled" />
            </div>
            <p className="text-text-secondary">Belum ada voucher yang digunakan</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.usedCoupons.map(voucher => (
              <VoucherCard
                key={voucher.id}
                voucher={voucher}
                type="used"
                discountApplied={voucher.discountApplied}
                usedAt={voucher.usedAt}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}