import Link from 'next/link';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { desc, eq, or } from 'drizzle-orm';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';

export const dynamic = 'force-dynamic';

export default async function ShipmentsPage() {
  const shippableOrders = await db.query.orders.findMany({
    where: or(
      eq(orders.status, 'processing'),
      eq(orders.status, 'packed'),
      eq(orders.status, 'shipped')
    ),
    orderBy: [desc(orders.createdAt)],
    limit: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pengiriman</h1>
        <span className="text-sm text-gray-500">{shippableOrders.length} pesanan aktif</span>
      </div>

      <div className="bg-white rounded-lg border border-admin-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-admin-content">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Penerima</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kurir</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {shippableOrders.map((order) => (
                <tr key={order.id} className="hover:bg-admin-content">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-sm">{order.orderNumber}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="font-medium">{order.recipientName}</div>
                    <div className="text-xs text-gray-500">{order.recipientPhone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {order.courierCode ? `${order.courierCode} ${order.courierService || ''}`.trim() : 'Belum ditentukan'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                    {order.trackingNumber || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                      order.status === 'shipped' ? 'bg-green-100 text-green-800' :
                      order.status === 'packed' ? 'bg-cyan-100 text-cyan-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="text-brand-red hover:underline"
                    >
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
              {shippableOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Tidak ada pesanan yang perlu dikirim
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
