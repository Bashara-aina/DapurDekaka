import { formatDateForOrder } from './format-date';

/**
 * Generate an order number in format DDK-YYYYMMDD-XXXX
 * @param sequenceNumber - The daily sequence number (1-9999)
 * @example generateOrderNumber(47) → "DDK-20260512-0047"
 */
export function generateOrderNumber(sequenceNumber: number): string {
  const dateStr = formatDateForOrder(new Date());
  const seq = String(sequenceNumber).padStart(4, '0');
  return `DDK-${dateStr}-${seq}`;
}

/**
 * Get Midtrans order_id with optional retry suffix
 * @param orderNumber - The order number
 * @param retryCount - The retry count (0 = first attempt)
 */
export function getMidtransOrderId(orderNumber: string, retryCount: number): string {
  if (retryCount === 0) return orderNumber;
  return `${orderNumber}-retry-${retryCount}`;
}
