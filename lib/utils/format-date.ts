import { format } from 'date-fns';
import { id, enUS } from 'date-fns/locale';
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
 * Format a date for blog cards — date only, no time.
 * Blog posts don't need clock precision; the time made cards look noisy.
 * @example formatBlogDate(new Date(), 'id') → "12 Mei 2026"
 * @example formatBlogDate(new Date(), 'en') → "May 12, 2026"
 */
export function formatBlogDate(
  date: Date | string | null | undefined,
  locale: string = 'id',
): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '-';
  const zonedDate = toZonedTime(d, 'Asia/Jakarta');
  if (locale === 'en') {
    return format(zonedDate, 'MMM d, yyyy', { locale: enUS });
  }
  return format(zonedDate, 'd MMM yyyy', { locale: id });
}

/**
 * Format a date for order number generation
 * @example formatDateForOrder(new Date()) → "20260512"
 */
export function formatDateForOrder(date: Date): string {
  return format(date, 'yyyyMMdd');
}
