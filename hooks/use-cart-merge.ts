'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@/store/cart.store';
import { toast } from 'sonner';
import { logger } from '@/lib/utils/logger';

/**
 * On login: sync local cart to DB when present, always hydrate from server.
 * WHY: empty localStorage used to skip loadFromDb — returning users saw an empty cart.
 */
export function useCartMerge(): void {
  const { data: session, status } = useSession();
  const { items, loadFromDb } = useCartStore();
  const hasRan = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;
    if (hasRan.current) return;

    hasRan.current = true;
    const localCount = items.length;

    const mergeCart = async (): Promise<void> => {
      try {
        if (localCount > 0) {
          const syncResult = await useCartStore.getState().syncToDb();
          if (!syncResult.success) {
            toast.error(syncResult.error || 'Gagal menyimpan keranjang');
            return;
          }
        }

        const loadResult = await loadFromDb();
        if (!loadResult.success) {
          toast.error(loadResult.error || 'Gagal memuat keranjang setelah login');
        }
      } catch (error) {
        logger.error('[useCartMerge] Failed to merge cart', {
          error: error instanceof Error ? error.message : String(error),
        });
        toast.error('Gagal menggabungkan keranjang');
      }
    };

    void mergeCart();
    // Intentionally omit `items` — run once per authenticated session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, status, loadFromDb]);
}
