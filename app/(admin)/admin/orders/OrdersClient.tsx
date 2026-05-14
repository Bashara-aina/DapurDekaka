'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';

interface OrderItem {
  id: string;
  orderNumber: string;
  status: string;
  recipientName: string;
  recipientEmail: string;
  totalAmount: number;
  createdAt: string;
  deliveryMethod: string;
}

interface OrdersClientProps {
  initialOrders: OrderItem[];
  userRole: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending_payment: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  packed: 'bg-cyan-100 text-cyan-800',
  shipped: 'bg-green-100 text-green-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-800',
  refunded: 'bg-pink-100 text-pink-800',
};

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Menunggu',
  paid: 'Dibayar',
  processing: 'Diproses',
  packed: 'Dikemas',
  shipped: 'Dikirim',
  delivered: 'Diterima',
  cancelled: 'Dibatalkan',
  refunded: 'Dikembalikan',
};

const TRANSITIONS: Record<string, { status: string; label: string }[]> = {
  paid: [{ status: 'processing', label: 'Proses' }],
  processing: [{ status: 'packed', label: 'Kemas' }],
  packed: [{ status: 'shipped', label: 'Kirim' }],
  shipped: [{ status: 'delivered', label: 'Terima' }],
};

export default function OrdersClient({ initialOrders, userRole }: OrdersClientProps) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const canUpdateStatus = ['superadmin', 'owner', 'warehouse'].includes(userRole);

  async function handleStatusUpdate(orderId: string, newStatus: string) {
    if (!confirm(`Yakin ubah status ke "${STATUS_LABELS[newStatus]}"?`)) return;

    setUpdatingId(orderId);
    setOpenDropdown(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal mengupdate status');
      }

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengupdate status');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-admin-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-admin-content">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pelanggan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border">
            {orders.map((order) => {
              const allowedTransitions = TRANSITIONS[order.status] || [];
              const isOpen = openDropdown === order.id;

              return (
                <tr key={order.id} className="hover:bg-admin-content">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{order.orderNumber}</span>
                      <span className="text-xs text-gray-400">{order.deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{order.recipientName}</div>
                    <div className="text-xs">{order.recipientEmail}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-red">
                    {formatIDR(order.totalAmount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatWIB(order.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/admin/orders/${order.id}`}
                        className="text-brand-red hover:underline"
                      >
                        Detail
                      </a>
                      {canUpdateStatus && allowedTransitions.length > 0 && (
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdown(isOpen ? null : order.id)}
                            disabled={updatingId === order.id}
                            className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                          >
                            {updatingId === order.id ? '...' : 'Update ▼'}
                          </button>
                          {isOpen && (
                            <div className="absolute right-0 mt-1 w-32 bg-white border border-admin-border rounded-lg shadow-lg z-10">
                              {allowedTransitions.map((t) => (
                                <button
                                  key={t.status}
                                  onClick={() => handleStatusUpdate(order.id, t.status)}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-admin-content rounded-lg"
                                >
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Belum ada pesanan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}