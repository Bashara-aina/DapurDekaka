import Link from 'next/link';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';
import { OrderStatusBadge } from './OrderStatusBadge';
import type { OrderStatus } from './OrderStatusBadge';

export interface OrdersTableOrder {
  id: string;
  orderNumber: string;
  status: string;
  recipientName: string;
  recipientEmail: string;
  totalAmount: number;
  createdAt: string;
  deliveryMethod: string;
}

interface OrdersTableProps {
  orders: OrdersTableOrder[];
  emptyMessage?: string;
  showDeliveryMethod?: boolean;
}

export function OrdersTable({
  orders,
  emptyMessage = 'Belum ada pesanan',
  showDeliveryMethod = true,
}: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 px-4 font-semibold text-gray-600 whitespace-nowrap">No. Pesanan</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-600 whitespace-nowrap">Pelanggan</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-600 whitespace-nowrap">Status</th>
            {showDeliveryMethod && (
              <th className="text-left py-3 px-4 font-semibold text-gray-600 whitespace-nowrap">Metode</th>
            )}
            <th className="text-right py-3 px-4 font-semibold text-gray-600 whitespace-nowrap">Total</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-600 whitespace-nowrap">Tanggal</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
            >
              <td className="py-3 px-4">
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="font-mono text-brand-red hover:underline font-medium"
                >
                  {order.orderNumber}
                </Link>
              </td>
              <td className="py-3 px-4">
                <div className="font-medium text-gray-900">{order.recipientName}</div>
                <div className="text-gray-400 text-xs">{order.recipientEmail}</div>
              </td>
              <td className="py-3 px-4">
                <OrderStatusBadge status={order.status as OrderStatus} />
              </td>
              {showDeliveryMethod && (
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      order.deliveryMethod === 'pickup'
                        ? 'bg-orange-50 text-orange-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {order.deliveryMethod === 'pickup' ? 'Ambil Sendiri' : 'Dikirim'}
                  </span>
                </td>
              )}
              <td className="py-3 px-4 text-right font-semibold text-gray-900">
                {formatIDR(order.totalAmount)}
              </td>
              <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                {formatWIB(new Date(order.createdAt))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}