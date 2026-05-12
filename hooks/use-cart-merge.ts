'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@/store/cart.store';
import type { CartItem } from '@/store/cart.store';

export function useCartMerge() {
  const { data: session, status } = useSession();
  const { items, clearCart } = useCartStore();

  useEffect(() => {
    const mergeCart = async () => {
      if (status !== 'authenticated' || !session?.user?.id) {
        return;
      }

      if (items.length === 0) {
        return;
      }

      try {
        const res = await fetch('/api/auth/merge-cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });

        if (res.ok) {
          clearCart();
        }
      } catch (error) {
        console.error('[useCartMerge] Failed to merge cart:', error);
      }
    };

    mergeCart();
  }, [session, status, items, clearCart]);
}