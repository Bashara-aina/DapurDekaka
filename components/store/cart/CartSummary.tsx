'use client';

import Link from 'next/link';
import { formatIDR } from '@/lib/utils/format-currency';
import { useCartStore } from '@/store/cart.store';

interface CartSummaryProps {
  shippingCost?: number;
  discount?: number;
  pointsRedemption?: number;
}

export function CartSummary({ shippingCost = 0, discount = 0, pointsRedemption = 0 }: CartSummaryProps) {
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getTotalItems = useCartStore((s) => s.getTotalItems);
  const getTotalWeight = useCartStore((s) => s.getTotalWeight);

  const subtotal = getSubtotal();
  const totalItems = getTotalItems();
  const totalWeight = getTotalWeight();
  const total = subtotal + shippingCost - discount - pointsRedemption;

  return (
    <div className="bg-white rounded-card shadow-card p-4 md:p-6">
      <h3 className="font-display font-semibold text-lg mb-4">Ringkasan Belanja</h3>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">Total Item ({totalItems})</span>
          <span className="font-medium">{formatIDR(subtotal)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary">Estimasi Berat</span>
          <span className="font-medium">{(totalWeight / 1000).toFixed(1)} kg</span>
        </div>

        {shippingCost > 0 && (
          <div className="flex justify-between">
            <span className="text-text-secondary">Ongkos Kirim</span>
            <span className="font-medium">{formatIDR(shippingCost)}</span>
          </div>
        )}

        {discount > 0 && (
          <div className="flex justify-between">
            <span className="text-text-secondary">Diskon</span>
            <span className="font-medium text-green-600">-{formatIDR(discount)}</span>
          </div>
        )}

        {pointsRedemption > 0 && (
          <div className="flex justify-between">
            <span className="text-text-secondary">Poin Digunakan</span>
            <span className="font-medium text-green-600">-{formatIDR(pointsRedemption)}</span>
          </div>
        )}

        <div className="border-t border-brand-cream-dark pt-3 flex justify-between">
          <span className="font-semibold text-text-primary">Total</span>
          <span className="font-body font-bold text-brand-red text-lg">{formatIDR(total)}</span>
        </div>
      </div>

      <Link
        href="/checkout"
        className="mt-6 w-full h-12 bg-brand-red text-white font-bold rounded-button flex items-center justify-center hover:bg-brand-red-dark transition-colors"
      >
        Lanjutkan ke Checkout
      </Link>
    </div>
  );
}