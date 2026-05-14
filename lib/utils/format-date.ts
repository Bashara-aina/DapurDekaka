import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

/**
 * Format a UTC timestamp to WIB display format
 * @example formatWIB(new Date()) → "12 Mei 2026, 01:30 WIB"
 */
export function formatWIB(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  const zonedDate = toZonedTime(d, 'Asia/Jakarta');
  return format(zonedDate, "d MMMM yyyy, HH:mm 'WIB'", { locale: id });
}

/**
 * Format a date for order number generation
 * @example formatDateForOrder(new Date()) → "20260512"
 */
export function formatDateForOrder(date: Date): string {
  return format(date, 'yyyyMMdd');
}
