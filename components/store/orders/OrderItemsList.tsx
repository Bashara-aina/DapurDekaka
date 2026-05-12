'use client';

import Image from 'next/image';
import { formatIDR } from '@/lib/utils/format-currency';

interface OrderItem {
  productNameId: string;
  variantNameId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  productImageUrl?: string | null;
}

interface OrderItemsListProps {
  items: OrderItem[];
  className?: string;
}

export function OrderItemsList({ items, className }: OrderItemsListProps) {
  return (
    <div className={className}>
      <h3 className="font-semibold mb-4">Item Pesanan</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.productNameId + item.variantNameId} className="flex gap-3">
            <div className="w-14 h-14 bg-brand-cream rounded overflow-hidden flex-shrink-0">
              {item.productImageUrl ? (
                <Image
                  src={item.productImageUrl}
                  alt={item.productNameId}
                  width={56}
                  height={56}
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
              <p className="text-sm font-bold text-brand-red mt-1">
                {formatIDR(item.subtotal)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}