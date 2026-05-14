import { cn } from '@/lib/utils/cn';

const STATUS_CONFIG = {
  pending_payment: { label: 'Menunggu Pembayaran', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  paid: { label: 'Pembayaran Diterima', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  processing: { label: 'Sedang Diproses', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  packed: { label: 'Dikemas', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  shipped: { label: 'Dalam Pengiriman', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  delivered: { label: 'Terkirim', className: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Dibatalkan', className: 'bg-gray-50 text-gray-600 border-gray-200' },
  refunded: { label: 'Refund Selesai', className: 'bg-gray-50 text-gray-500 border-gray-200' },
} as const;

type OrderStatus = keyof typeof STATUS_CONFIG;

interface OrderStatusBadgeProps {
  status: string;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status as OrderStatus] ?? STATUS_CONFIG.cancelled;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-semibold border',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}