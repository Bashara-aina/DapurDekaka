'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  OrdersTable,
  type OrdersTableOrder,
} from '@/components/admin/orders/OrdersTable';

interface OrderItem extends OrdersTableOrder {}

interface OrdersClientProps {
  initialOrders: OrderItem[];
  userRole: string;
  totalPages: number;
  currentPage: number;
  totalOrders: number;
  pageSize: number;
  searchQuery?: string | null;
}

const TRANSITIONS: Record<string, { status: string; label: string }[]> = {
  paid: [{ status: 'processing', label: 'Proses' }],
  processing: [{ status: 'packed', label: 'Kemas' }],
  packed: [{ status: 'shipped', label: 'Kirim' }],
  shipped: [{ status: 'delivered', label: 'Terima' }],
};

// H-03: Filter transitions based on role — warehouse can only do packed→shipped
function getAllowedTransitions(status: string, role: string) {
  if (role === 'warehouse') {
    return status === 'packed' ? TRANSITIONS[status] ?? [] : [];
  }
  return TRANSITIONS[status] ?? [];
}

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
    const label = TRANSITIONS[orders.find((o) => o.id === orderId)?.status ?? '']?.find(
      (t) => t.status === newStatus
    )?.label;
    if (!confirm(`Yakin ubah status ke "${label ?? newStatus}"?`)) return;

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

      <div className="flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari no. pesanan, nama, email..."
              className="w-full h-10 pl-3 pr-10 rounded-md border border-input bg-white text-sm"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(''); clearSearch(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <button
            type="submit"
            className="h-10 px-4 bg-admin-sidebar text-white text-sm font-medium rounded-md hover:bg-admin-sidebar-hover transition-colors"
          >
            Cari
          </button>
        </form>

        <select
          value={searchParams.get('status') ?? 'all'}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            if (e.target.value === 'all') {
              params.delete('status');
            } else {
              params.set('status', e.target.value);
            }
            params.set('page', '1');
            router.push(`/admin/orders?${params.toString()}`);
          }}
          className="h-10 px-3 rounded-md border border-input bg-white text-sm text-gray-700"
          aria-label="Filter status"
        >
          <option value="all">Semua Status</option>
          <option value="pending_payment">Menunggu Bayar</option>
          <option value="paid">Dibayar</option>
          <option value="processing">Diproses</option>
          <option value="packed">Dikemas</option>
          <option value="shipped">Dikirim</option>
          <option value="delivered">Diterima</option>
          <option value="cancelled">Dibatalkan</option>
          <option value="refunded">Dikembalikan</option>
        </select>
      </div>
      {searchQuery && (
        <p className="text-sm text-gray-500">
          Hasil pencarian: <strong>&quot;{searchQuery}&quot;</strong> — {totalOrders.toLocaleString('id-ID')} pesanan ditemukan
        </p>
      )}

      <div className="bg-white rounded-lg border border-admin-border overflow-x-auto">
        <div className="min-w-[640px]">
          <OrdersTable
            orders={orders}
            renderActions={(order) => {
              const allowedTransitions = getAllowedTransitions(order.status, userRole);
              const isOpen = openDropdown === order.id;
              return (
                <div className="flex items-center gap-2">
                  <a
                    href={`/admin/orders/${order.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="text-brand-red hover:underline text-sm"
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
              );
            }}
          />
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
                        ? 'bg-admin-sidebar text-white'
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