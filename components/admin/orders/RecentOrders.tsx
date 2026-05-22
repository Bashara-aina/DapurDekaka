import Link from 'next/link';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';
import { OrderStatusBadge } from './OrderStatusBadge';
import type { OrderStatus } from './OrderStatusBadge';

export interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  recipientName: string;
  totalAmount: number;
  createdAt: string;
  deliveryMethod: string;
}

interface RecentOrdersProps {
  orders: RecentOrder[];
  maxItems?: number;
  className?: string;
}

export function RecentOrders({ orders, maxItems = 5, className }: RecentOrdersProps) {
  const displayOrders = orders.slice(0, maxItems);

  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p className="text-sm">Belum ada pesanan terbaru</p>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      {displayOrders.map((order) => (
        <Link
          key={order.id}
          href={`/admin/orders/${order.id}`}
          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-cream flex items-center justify-center">
              <span className="text-xs font-bold text-brand-red">
                {order.recipientName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-medium text-brand-red group-hover:underline">
                  {order.orderNumber}
                </span>
                <OrderStatusBadge status={order.status as OrderStatus} />
              </div>
              <div className="text-sm text-gray-500 truncate">
                {order.recipientName}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="font-semibold text-gray-900 text-sm">
              {formatIDR(order.totalAmount)}
            </div>
            <div className="text-xs text-gray-400">
              {formatWIB(new Date(order.createdAt))}
            </div>
          </div>
        </Link>
      ))}
      {orders.length > maxItems && (
        <Link
          href="/admin/orders"
          className="block text-center text-sm text-brand-red hover:underline pt-2"
        >
          Lihat semua pesanan →
        </Link>
      )}
    </div>
  );
}