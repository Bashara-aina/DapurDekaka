import Link from 'next/link';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  paidAt: string | null;
}

interface CustomerOrderHistoryProps {
  orders: Order[];
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Menunggu Pembayaran',
  paid: 'Sudah Dibayar',
  processing: 'Sedang Diproses',
  packed: 'Dikemas',
  shipped: 'Dikirim',
  delivered: 'Diterima',
  cancelled: 'Dibatalkan',
  refunded: 'Dikembalikan',
};

export default function CustomerOrderHistory({ orders }: CustomerOrderHistoryProps) {
  return (
    <div className="bg-white rounded-lg border border-admin-border p-6 lg:col-span-2">
      <h2 className="font-semibold text-gray-700 mb-4">Riwayat Pesanan</h2>
      {orders.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-admin-content">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {orders.map(order => (
                <tr key={order.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${order.id}`} className="font-medium text-sm hover:underline">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded bg-gray-100 text-gray-800`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-brand-red">
                    {formatIDR(order.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatWIB(order.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Belum ada pesanan</p>
      )}
    </div>
  );
}