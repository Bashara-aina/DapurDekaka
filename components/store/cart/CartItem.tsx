'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useCartStore, type CartItem as CartItemType } from '@/store/cart.store';
import { formatIDR } from '@/lib/utils/format-currency';
import { cn } from '@/lib/utils/cn';

interface CartItemProps {
  item: CartItemType;
}

export function CartItem({ item }: CartItemProps) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const DELETE_THRESHOLD = -80;

  const maxQty = Math.min(99, item.stock ?? 99);

  function handleTouchStart(e: React.TouchEvent) {
    if (!e.touches[0]) return;
    startX.current = e.touches[0].clientX;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!e.touches[0]) return;
    const dx = e.touches[0].clientX - startX.current;
    setSwipeX(Math.max(DELETE_THRESHOLD, Math.min(0, dx)));
  }

  function handleTouchEnd() {
    if (swipeX <= DELETE_THRESHOLD * 0.8) {
      removeItem(item.variantId);
    } else {
      setSwipeX(0);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Delete background */}
      <div className="absolute inset-y-0 right-0 w-20 bg-[#DC2626] flex items-center justify-center rounded-r-lg">
        <Trash2 size={20} className="text-white" />
      </div>

      {/* Item content */}
      <div
        className="relative bg-white transition-transform"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex gap-3 p-4">
          {/* Image */}
          <div className="w-16 h-16 flex-shrink-0 bg-brand-cream rounded-lg overflow-hidden">
            <Image
              src={item.imageUrl || '/placeholder.jpg'}
              alt={item.productNameId}
              width={64}
              height={64}
              className="object-cover w-full h-full"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm text-[#1A1A1A] line-clamp-1">
              {item.productNameId}
            </h3>
            <p className="text-[#6B6B6B] text-xs mt-0.5">{item.variantNameId}</p>
            <p className="font-bold text-brand-red text-sm mt-1">
              {formatIDR(item.unitPrice)}
            </p>
          </div>

          {/* Quantity stepper */}
          <div className="flex flex-col items-end justify-between">
            <button
              onClick={() => removeItem(item.variantId)}
              className="p-1.5 text-[#6B6B6B] hover:text-[#DC2626] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Hapus dari keranjang"
            >
              <Trash2 size={16} />
            </button>

            <div className="flex items-center border border-brand-cream-dark rounded-button overflow-hidden">
              <button
                onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                className="w-9 h-9 flex items-center justify-center text-brand-red hover:bg-brand-cream transition-colors"
                aria-label="Kurangi jumlah"
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-sm font-semibold select-none">
                {item.quantity}
              </span>
              <button
                onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                disabled={item.quantity >= maxQty}
                className="w-9 h-9 flex items-center justify-center text-brand-red hover:bg-brand-cream transition-colors disabled:opacity-40"
                aria-label="Tambah jumlah"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
