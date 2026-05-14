'use client';

import { useCallback, useRef } from 'react';

export function useCartBadgeAnimation() {
  const badgeRef = useRef<HTMLSpanElement>(null);

  const trigger = useCallback(() => {
    if (!badgeRef.current) return;
    badgeRef.current.classList.remove('cart-badge-bounce');
    void badgeRef.current.offsetWidth;
    badgeRef.current.classList.add('cart-badge-bounce');
  }, []);

  return { badgeRef, trigger };
}