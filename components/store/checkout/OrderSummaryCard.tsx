'use client';

import Image from 'next/image';
import { formatIDR } from '@/lib/utils/format-currency';
import { cn } from '@/lib/utils/cn';
import type { CartItem } from '@/store/cart.store';

interface OrderSummaryCardProps {
  items: CartItem[];
  subtotal: number;
  discountAmount?: number;
  shippingCost?: number;
  pointsDiscount?: number;
  totalAmount: number;
  className?: string;
}

export function OrderSummaryCard({
  items,
  subtotal,
  discountAmount = 0,
  shippingCost = 0,
  pointsDiscount = 0,
  totalAmount,
  className,
}: OrderSummaryCardProps) {
  return (
    <div className={cn('bg-white rounded-card p-6 shadow-card sticky top-32', className)}>
      <h3 className="font-semibold mb-4">Ringkasan Pesanan</h3>

      <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
        {items.map((item) => (
          <div key={item.variantId} className="flex gap-3">
            <div className="w-12 h-12 bg-brand-cream rounded overflow-hidden flex-shrink-0">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.productNameId}
                  width={48}
                  height={48}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full bg-brand-cream-dark" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.productNameId}</p>
              <p className="text-xs text-text-secondary">
                {item.variantNameId} × {item.quantity}
              </p>
            </div>
            <p className="text-sm font-medium">
              {formatIDR(item.unitPrice * item.quantity)}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-brand-cream-dark pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Subtotal</span>
          <span>{formatIDR(subtotal)}</span>
        </div>

        {discountAmount > 0 && (
          <div className="flex justify-between text-sm text-success">
            <span>Diskon</span>
            <span>-{formatIDR(discountAmount)}</span>
          </div>
        )}

        {pointsDiscount > 0 && (
          <div className="flex justify-between text-sm text-success">
            <span>Points Digunakan</span>
            <span>-{formatIDR(pointsDiscount)}</span>
          </div>
        )}

        {shippingCost > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Ongkos Kirim</span>
            <span>{formatIDR(shippingCost)}</span>
          </div>
        )}

        <div className="flex justify-between font-bold text-lg pt-2 border-t border-brand-cream-dark">
          <span>Total</span>
          <span className="text-brand-red">{formatIDR(totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}