import { SHIPPING_MARKUP_PERCENT } from './constants';

/**
 * Apply hidden shipping markup to Biteship actual cost.
 * Returns integer IDR rounded up.
 */
export function applyMarkup(actualCost: number): number {
  if (actualCost <= 0) return 0;
  const multiplier = 1 + SHIPPING_MARKUP_PERCENT / 100;
  return Math.ceil(actualCost * multiplier);
}

/**
 * Calculate markup amount stored server-side for margin tracking.
 */
export function getMarkupAmount(actualCost: number, customerCost: number): number {
  return Math.max(0, customerCost - actualCost);
}

/**
 * Verify client-submitted shipping cost matches server calculation.
 */
export function verifyCustomerShippingCost(
  actualCost: number,
  customerCost: number
): boolean {
  return customerCost === applyMarkup(actualCost);
}
