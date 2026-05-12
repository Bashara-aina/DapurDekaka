import { cn } from '@/lib/utils/cn';

interface StockBadgeProps {
  stock: number;
  className?: string;
}

export function StockBadge({ stock, className }: StockBadgeProps) {
  if (stock === 0) {
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-1 bg-text-secondary/10 text-text-secondary text-xs font-semibold rounded',
          className
        )}
      >
        Habis
      </span>
    );
  }

  if (stock < 5) {
    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-1 bg-warning-light text-warning text-xs font-semibold rounded',
          className
        )}
      >
        Tersisa {stock} pcs
      </span>
    );
  }

  return null;
}
