import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
  const allOrders = await db.query.orders.findMany({
    orderBy: [desc(orders.createdAt)],
    limit: 10,
  });

  const paidOrders = allOrders.filter(o => o.status === 'paid');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const orderCount = paidOrders.length;
  const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

  return {
    totalRevenue,
    orderCount,
    avgOrderValue,
    recentOrders: allOrders.slice(0, 10),
  };
}

export default async function AdminDashboard() {
  const { totalRevenue, orderCount, avgOrderValue, recentOrders } = await getDashboardData();

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 border border-admin-border">
          <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold">{formatIDR(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-lg p-6 border border-admin-border">
          <p className="text-sm text-gray-500 mb-1">Total Pesanan</p>
          <p className="text-2xl font-bold">{orderCount}</p>
        </div>
        <div className="bg-white rounded-lg p-6 border border-admin-border">
          <p className="text-sm text-gray-500 mb-1">Rata-rata Order</p>
          <p className="text-2xl font-bold">{formatIDR(avgOrderValue)}</p>
        </div>
        <div className="bg-white rounded-lg p-6 border border-admin-border">
          <p className="text-sm text-gray-500 mb-1">Pesanan Baru</p>
          <p className="text-2xl font-bold">
            {recentOrders.filter(o => o.status === 'pending_payment').length}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg p-6 border border-admin-border">
        <h2 className="font-semibold mb-4">Aksi Cepat</h2>
        <div className="flex flex-wrap gap-3">
          <form action="/api/admin/points/expiry-reminders" method="POST">
            <button
              type="submit"
              className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
            >
              Kirim Pengingat Poin Akan Hangus
            </button>
          </form>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg border border-admin-border">
        <div className="px-6 py-4 border-b border-admin-border">
          <h2 className="font-semibold">Pesanan Terbaru</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-admin-content">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pelanggan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-admin-content">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-sm">{order.orderNumber}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {order.recipientName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                      order.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'shipped' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-red">
                    {formatIDR(order.totalAmount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatWIB(order.createdAt)}
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Belum ada pesanan
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
