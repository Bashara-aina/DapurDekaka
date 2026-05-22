'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@/store/cart.store';
import type { CartItem } from '@/store/cart.store';

export function useCartMerge() {
  const { data: session, status } = useSession();
  const { items, addItem, clearCart } = useCartStore();
  const hasRan = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;
    if (hasRan.current) return;
    if (items.length === 0) return;

    hasRan.current = true;

    const mergeCart = async () => {
      try {
        const res = await fetch('/api/auth/merge-cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });

        if (res.ok) {
          const json = await res.json();
          // Apply merged items from server response instead of just clearing
          if (json.success && Array.isArray(json.data?.mergedItems)) {
            clearCart();
            for (const mergedItem of json.data.mergedItems) {
              addItem(mergedItem);
            }
          } else {
            clearCart();
          }
        }
      } catch (error) {
        console.error('[useCartMerge] Failed to merge cart:', error);
      }
    };

    mergeCart();
  }, [session, status, items, clearCart, addItem]);
}