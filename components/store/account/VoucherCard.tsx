import { Tag, Clock, Percent } from 'lucide-react';
import type { Coupon } from '@/lib/db/schema';

interface VoucherCardProps {
  voucher: Coupon;
  type?: 'available' | 'used';
  discountApplied?: number;
  usedAt?: Date;
}

export function VoucherCard({ voucher, type = 'available', discountApplied, usedAt }: VoucherCardProps) {
  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const isExpired = voucher.expiresAt && new Date(voucher.expiresAt) < new Date();
  const isPercentage = voucher.type === 'percentage';

  return (
    <div className={`bg-white rounded-card border p-4 ${
      isExpired
        ? 'border-gray-200 opacity-60'
        : 'border-brand-gold/30 hover:border-brand-gold transition-colors'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0
          ${isExpired ? 'bg-gray-100' : 'bg-brand-gold/10'}
        `}>
          {isPercentage ? (
            <Percent className={`w-6 h-6 ${isExpired ? 'text-gray-400' : 'text-brand-gold'}`} />
          ) : (
            <Tag className={`w-6 h-6 ${isExpired ? 'text-gray-400' : 'text-brand-gold'}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-text-primary font-mono">{voucher.code}</p>
            {isExpired && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded">
                expired
              </span>
            )}
          </div>

          <p className="font-medium text-text-primary mt-1">{voucher.nameId}</p>

          <div className="mt-2 space-y-1">
            {voucher.type === 'percentage' && voucher.discountValue && (
              <p className="text-sm text-brand-red font-bold">
                {voucher.discountValue}% OFF
                {voucher.maxDiscountAmount && (
                  <span className="text-text-secondary font-normal">
                    {' '}maks {formatIDR(voucher.maxDiscountAmount)}
                  </span>
                )}
              </p>
            )}
            {voucher.type === 'fixed' && voucher.discountValue && (
              <p className="text-sm text-brand-red font-bold">
                {formatIDR(voucher.discountValue)} OFF
              </p>
            )}
            {voucher.type === 'free_shipping' && (
              <p className="text-sm text-brand-red font-bold">Gratis Ongkir</p>
            )}

            {voucher.minOrderAmount > 0 && (
              <p className="text-xs text-text-secondary">
                Min. belanja {formatIDR(voucher.minOrderAmount)}
              </p>
            )}
          </div>

          {type === 'available' && voucher.expiresAt && (
            <div className="flex items-center gap-1 mt-2 text-xs text-text-secondary">
              <Clock className="w-3 h-3" />
              <span>Berlaku hingga {formatDate(voucher.expiresAt)}</span>
            </div>
          )}

          {type === 'used' && usedAt && (
            <p className="text-xs text-text-secondary mt-2">
              Digunakan pada {formatDate(usedAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}