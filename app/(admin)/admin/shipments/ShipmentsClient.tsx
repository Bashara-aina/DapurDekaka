'use client';

import { useState, useEffect } from 'react';
import { formatWIB } from '@/lib/utils/format-date';
import { formatIDR } from '@/lib/utils/format-currency';
import { toast } from 'sonner';

interface ShipmentOrder {
  id: string;
  orderNumber: string;
  recipientName: string;
  recipientPhone: string;
  courierCode: string | null;
  courierService: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: string;
  totalAmount: number;
  paidAt: string | null;
  createdAt: string;
  city: string | null;
  province: string | null;
}

interface ShipmentsClientProps {
  initialOrders: ShipmentOrder[];
}

export default function ShipmentsClient({ initialOrders }: ShipmentsClientProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());

  async function handleSubmitTracking(orderId: string) {
    const trackingNumber = trackingInputs[orderId]?.trim();
    if (!trackingNumber) {
      toast.error('Nomor resi harus diisi');
      return;
    }

    setSubmittingIds((prev) => new Set(prev).add(orderId));
    try {
      const res = await fetch('/api/admin/field/tracking-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, trackingNumber }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan nomor resi');
      }

      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setTrackingInputs((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      toast.success('Nomor resi berhasil disimpan');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan nomor resi');
    } finally {
      setSubmittingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pengiriman</h1>
        <span className="text-sm text-gray-500">{orders.length} pesanan aktif</span>
      </div>

      <div className="bg-white rounded-lg border border-admin-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-admin-content">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Penerima</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kota</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kurir</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tgl Dibayar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {orders.map((order) => {
                const isSubmitting = submittingIds.has(order.id);
                const hasTracking = !!order.trackingNumber;

                return (
                  <tr key={order.id} className="hover:bg-admin-content">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium text-sm">{order.orderNumber}</span>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatIDR(order.totalAmount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="font-medium">{order.recipientName}</div>
                      <div className="text-xs text-gray-500">{order.recipientPhone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="font-medium">{order.city ?? '-'}</div>
                      {order.province && <div className="text-xs text-gray-400">{order.province}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.courierCode
                        ? `${order.courierCode} ${order.courierService || ''}`.trim()
                        : 'Belum ditentukan'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                        order.status === 'packed' ? 'bg-cyan-100 text-cyan-800' :
                        order.status === 'shipped' ? 'bg-green-100 text-green-800' :
                        order.status === 'processing' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {order.status === 'packed' ? 'Siap Kirim' :
                         order.status === 'shipped' ? 'Dikirim' :
                         order.status === 'processing' ? 'Diproses' :
                         order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.paidAt ? formatWIB(order.paidAt) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {order.status === 'shipped' && hasTracking ? (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
                          {order.trackingNumber}
                        </span>
                      ) : order.status === 'packed' || order.status === 'shipped' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="No. Resi"
                            value={trackingInputs[order.id] ?? ''}
                            onChange={(e) =>
                              setTrackingInputs((prev) => ({ ...prev, [order.id]: e.target.value }))
                            }
                            disabled={isSubmitting}
                            className="h-8 w-40 px-2 text-sm rounded border border-admin-border bg-white disabled:opacity-50"
                          />
                          <button
                            onClick={() => handleSubmitTracking(order.id)}
                            disabled={isSubmitting || !trackingInputs[order.id]?.trim()}
                            className="h-8 px-3 text-xs font-medium bg-brand-red text-white rounded hover:bg-brand-red-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isSubmitting ? '...' : 'Kirim'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
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