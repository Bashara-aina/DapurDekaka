'use client';

import { useState, useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatIDR } from '@/lib/utils/format-currency';
import { OrderStatusBadge } from '@/components/admin/orders/OrderStatusBadge';
import { getRelativeTime, LIVE_FEED_FILTERS, type LiveOrder } from './types';

export interface LiveOrderFeedProps {
  orders: LiveOrder[] | null | undefined;
  limit?: number;
}

export function LiveOrderFeed({ orders, limit = 15 }: LiveOrderFeedProps) {
  const [filter, setFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    const list = orders ?? [];
    return filter === 'all' ? list : list.filter((o) => o.status === filter);
  }, [orders, filter]);

  return (
    <div className="bg-white rounded-xl border border-admin-border">
      <div className="px-5 py-4 border-b border-admin-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-text-primary">Live Order Feed</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            refresh 30s
          </span>
        </div>
        <a
          href="/admin/orders"
          className="text-xs text-brand-red hover:underline flex items-center gap-1"
        >
          Lihat semua <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="px-5 py-2.5 border-b border-admin-border flex gap-1.5 overflow-x-auto">
        {LIVE_FEED_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
              filter === f.key
                ? 'bg-admin-sidebar text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full min-w-[600px]">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Waktu
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Pelanggan
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Item
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Total
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.slice(0, limit).map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-xs font-mono font-medium text-text-primary whitespace-nowrap">
                  {order.orderNumber}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                  {getRelativeTime(order.createdAt)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 max-w-[120px] truncate">
                  {order.recipientName}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {order.totalItems} item
                  {order.itemSummary?.[0] && (
                    <span className="text-gray-400">
                      {' '}· {order.itemSummary[0].name}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-brand-red whitespace-nowrap">
                  {formatIDR(order.totalAmount)}
                </td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`/admin/orders/${order.id}`}
                    className="text-xs text-brand-red hover:underline font-medium"
                  >
                    Detail
                  </a>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-gray-400 text-sm"
                >
                  Tidak ada pesanan
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}