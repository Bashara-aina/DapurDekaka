'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@/store/cart.store';
import { toast } from 'sonner';

export function useCartMerge() {
  const { data: session, status } = useSession();
  const { items, clearCart, loadFromDb } = useCartStore();
  const hasRan = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;
    if (hasRan.current) return;
    if (items.length === 0) return;

    hasRan.current = true;

    const mergeCart = async () => {
      try {
        const syncResult = await useCartStore.getState().syncToDb();
        if (!syncResult.success) {
          toast.error(syncResult.error || 'Gagal menyimpan keranjang');
          return;
        }

        const loadResult = await loadFromDb();
        if (!loadResult.success) {
          toast.error(loadResult.error || 'Gagal memuat keranjang setelah login');
          return;
        }

        clearCart();
      } catch (error) {
        console.error('[useCartMerge] Failed to merge cart:', error);
        toast.error('Gagal menggabungkan keranjang');
      }
    };

    mergeCart();
  }, [session, status, items, clearCart, loadFromDb]);
}