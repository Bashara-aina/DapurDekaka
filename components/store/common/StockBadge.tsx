import { cn } from '@/lib/utils/cn';
import { useCartStore } from '@/store/cart.store';

interface StockBadgeProps {
  /** Direct stock value — used for product pages (static display) */
  stock?: number;
  /** When provided, subscribes to cart store for live stock after validateStock() */
  variantId?: string;
  className?: string;
}

export function StockBadge({ stock: directStock, variantId, className }: StockBadgeProps) {
  // Always call the hook — derive the value from the result
  const cartStock = useCartStore((s) =>
    variantId ? s.items.find((i) => i.variantId === variantId)?.stock : undefined
  );

  const stock = cartStock ?? directStock;

  if (stock === undefined || stock === 0) {
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
