/** SessionStorage key for checkout form persistence (P2 backlog #8). */
export const CHECKOUT_DRAFT_KEY = 'ddk-checkout-draft';

export interface CheckoutDraft {
  readonly recipientName: string;
  readonly recipientEmail: string;
  readonly recipientPhone: string;
  readonly deliveryMethod: 'delivery' | 'pickup';
  readonly customerNote: string;
  readonly savedAt: number;
}

export function saveCheckoutDraft(draft: Omit<CheckoutDraft, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      CHECKOUT_DRAFT_KEY,
      JSON.stringify({ ...draft, savedAt: Date.now() })
    );
  } catch {
    // quota / private mode — non-fatal
  }
}

export function loadCheckoutDraft(): CheckoutDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutDraft;
    if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearCheckoutDraft(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
}
