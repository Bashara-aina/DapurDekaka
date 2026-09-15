/**
 * Read persisted cart items from localStorage without throwing.
 * Corrupt/foreign data returns [] (and clears the key) instead of
 * crashing the caller — login/register must never fail because of a
 * broken cart blob.
 */

export interface LocalCartItem {
  variantId: string;
  quantity: number;
  [key: string]: unknown;
}

const CART_KEY = 'dapur-cart';

export function readLocalCartItems(): LocalCartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      state?: { items?: LocalCartItem[] };
    };
    return Array.isArray(parsed?.state?.items) ? parsed.state.items : [];
  } catch {
    try {
      localStorage.removeItem(CART_KEY);
    } catch {
      // storage itself unavailable — nothing to clear
    }
    return [];
  }
}

export function clearLocalCart(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CART_KEY);
  } catch {
    // ignore — non-fatal
  }
}
