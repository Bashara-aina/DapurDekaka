'use client';

import Image from 'next/image';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useCartStore } from '@/store/cart.store';
import { formatIDR } from '@/lib/utils/format-currency';
import { cn } from '@/lib/utils/cn';
import type { CartItem } from '@/store/cart.store';

interface CartItemProps {
  item: CartItem;
}

export function CartItemComponent({ item }: CartItemProps) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const maxQty = Math.min(99, item.stock);

  return (
    <div className="bg-white rounded-card shadow-card overflow-hidden">
      <div className="flex gap-3 p-3 md:p-4">
        {/* Image */}
        <div className="w-16 h-16 md:w-20 md:h-20 flex-shrink-0 bg-brand-cream rounded-lg overflow-hidden">
          <Image
            src={item.imageUrl}
            alt={item.productNameId}
            width={80}
            height={80}
            className="object-cover w-full h-full"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm md:text-base text-text-primary line-clamp-1">
            {item.productNameId}
          </h3>
          <p className="text-text-secondary text-xs md:text-sm">{item.variantNameId}</p>
          <p className="font-body font-bold text-brand-red text-sm md:text-base mt-1">
            {formatIDR(item.unitPrice)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end justify-between">
          <button
            onClick={() => removeItem(item.variantId)}
            className="p-1.5 text-text-secondary hover:text-red-600 transition-colors"
            aria-label="Hapus item"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Quantity stepper */}
          <div className="flex items-center border border-brand-cream-dark rounded-button">
            <button
              onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
              className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center text-brand-red hover:bg-brand-cream transition-colors"
              aria-label="Kurangi jumlah"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-8 md:w-10 text-center text-sm md:text-base font-bold">
              {item.quantity}
            </span>
            <button
              onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
              className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center text-brand-red hover:bg-brand-cream transition-colors disabled:opacity-40"
              disabled={item.quantity >= maxQty}
              aria-label="Tambah jumlah"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Subtotal */}
      <div className="bg-brand-cream px-4 py-2 text-right">
        <span className="text-text-secondary text-xs md:text-sm">Subtotal: </span>
        <span className="font-body font-bold text-brand-red text-sm md:text-base">
          {formatIDR(item.unitPrice * item.quantity)}
        </span>
      </div>
    </div>
  );
}