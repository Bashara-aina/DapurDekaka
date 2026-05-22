import { cn } from '@/lib/utils/cn';

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Menunggu Pembayaran',
  paid: 'Sudah Bayar',
  processing: 'Diproses',
  packed: 'Dikemas',
  shipped: 'Dikirim',
  delivered: 'Diterima',
  cancelled: 'Dibatalkan',
  refunded: 'Dikembalikan',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending_payment: 'bg-amber-100 text-amber-800 border-amber-200',
  paid: 'bg-blue-100 text-blue-800 border-blue-200',
  processing: 'bg-purple-100 text-purple-800 border-purple-200',
  packed: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  shipped: 'bg-green-100 text-green-800 border-green-200',
  delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  refunded: 'bg-pink-100 text-pink-800 border-pink-200',
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
  showDot?: boolean;
}

export function OrderStatusBadge({ status, className, showDot = false }: OrderStatusBadgeProps) {
  const label = STATUS_LABELS[status] ?? status;
  const colorClass = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        colorClass,
        className
      )}
    >
      {showDot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
      )}
      {label}
    </span>
  );
}