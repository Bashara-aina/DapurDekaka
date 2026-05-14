'use client';

import { useCartStore } from '@/store/cart.store';
import { CartItem } from '@/components/store/cart/CartItem';
import { CartSummary } from '@/components/store/cart/CartSummary';
import { EmptyCart } from '@/components/store/cart/EmptyCart';

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const getTotalItems = useCartStore((s) => s.getTotalItems);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-brand-cream">
        <div className="bg-white border-b border-brand-cream-dark py-6 px-4">
          <h1 className="font-display text-2xl font-bold">Keranjang</h1>
        </div>
        <EmptyCart />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream pb-32">
      <div className="bg-white border-b border-brand-cream-dark py-6 px-4">
        <h1 className="font-display text-2xl font-bold">Keranjang</h1>
        <p className="text-text-secondary text-sm mt-1">{getTotalItems()} item</p>
      </div>

      <div className="px-4 py-4 container mx-auto">
        <div className="lg:grid lg:grid-cols-3 lg:gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <CartItem key={item.variantId} item={item} />
            ))}
          </div>

          {/* Cart Summary */}
          <div className="mt-4 lg:mt-0">
            <CartSummary />
          </div>
        </div>
      </div>
    </div>
  );
}