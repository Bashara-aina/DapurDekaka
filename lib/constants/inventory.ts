/**
 * Hide "add to cart" / treat as low when stock is at or below this threshold.
 * Oversell is still handled at settlement; this is a UX safety buffer only.
 * Change with Bashara if warehouse wants a different buffer.
 */
export const SAFETY_STOCK = 2;
