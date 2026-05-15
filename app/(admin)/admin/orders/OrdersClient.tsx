'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  totalPages: number;
  currentPage: number;
  totalOrders: number;
  pageSize: number;
  searchQuery?: string | null;
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

export default function OrdersClient({
  initialOrders,
  userRole,
  totalPages,
  currentPage,
  totalOrders,
  pageSize,
  searchQuery,
}: OrdersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState(initialOrders);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(searchQuery ?? '');

  const canUpdateStatus = ['superadmin', 'owner', 'warehouse'].includes(userRole);
  const statusFilter = searchParams.get('status');

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

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengupdate status');
    } finally {
      setUpdatingId(null);
    }
  }

  function buildPageUrl(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    return `/admin/orders?${params.toString()}`;
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchInput.trim()) {
      params.set('search', searchInput.trim());
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    router.push(`/admin/orders?${params.toString()}`);
  }

  function clearSearch() {
    setSearchInput('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('search');
    params.set('page', '1');
    router.push(`/admin/orders?${params.toString()}`);
  }

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalOrders);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Pesanan</h1>
        {statusFilter && (
          <span className="text-sm text-gray-500">
            Filter: <strong>{statusFilter}</strong>{' '}
            <a href="/admin/orders" className="text-brand-red hover:underline ml-1">
              (clear)
            </a>
          </span>
        )}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Cari no. pesanan, nama, email..."
          className="flex-1 h-10 px-3 rounded-md border border-input bg-white text-sm"
        />
        <button
          type="submit"
          className="h-10 px-4 bg-[#0F172A] text-white text-sm font-medium rounded-md hover:bg-[#1e293b] transition-colors"
        >
          Cari
        </button>
        {searchQuery && (
          <button
            type="button"
            onClick={clearSearch}
            className="h-10 px-4 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 transition-colors"
          >
            Hapus
          </button>
        )}
      </form>
      {searchQuery && (
        <p className="text-sm text-gray-500">
          Hasil pencarian: <strong>&quot;{searchQuery}&quot;</strong> — {totalOrders.toLocaleString('id-ID')} pesanan ditemukan
        </p>
      )}

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
                        <span className="text-xs text-gray-400">
                          {order.deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{order.recipientName}</div>
                      <div className="text-xs">{order.recipientEmail}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                          STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
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

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-admin-border flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Menampilkan {startItem}–{endItem} dari {totalOrders.toLocaleString('id-ID')} pesanan
              {statusFilter && (
                <span className="ml-1">
                  (filter: <strong>{statusFilter}</strong>)
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(buildPageUrl(currentPage - 1))}
                disabled={currentPage <= 1}
                className="p-2 rounded border border-admin-border hover:bg-admin-content disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => router.push(buildPageUrl(pageNum))}
                    className={`w-9 h-9 rounded text-sm font-medium ${
                      pageNum === currentPage
                        ? 'bg-[#0F172A] text-white'
                        : 'border border-admin-border hover:bg-admin-content text-gray-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => router.push(buildPageUrl(currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="p-2 rounded border border-admin-border hover:bg-admin-content disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Halaman berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}