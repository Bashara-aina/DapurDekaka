/**
 * Format a number as Indonesian Rupiah
 * @example formatIDR(120000) → "Rp 120.000"
 */
export function formatIDR(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

/**
 * Convert IDR to integer (no-op, enforces floor)
 */
export function toIDRInt(value: number): number {
  return Math.floor(value);
}
