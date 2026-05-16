'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';
import { buildTrackingUrl } from '@/lib/constants/couriers';
import type { Order, OrderItem, User } from '@/lib/db/schema';

interface OrderHistoryEntry {
  id: string;
  orderId: string;
  fromStatus: string | null;
  toStatus: string;
  changedByUserId: string | null;
  changedByType: string;
  note: string | null;
  metadata: unknown;
  createdAt: string;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  deliveryMethod: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  addressLine: string | null;
  district: string | null;
  city: string | null;
  cityId: string | null;
  province: string | null;
  postalCode: string | null;
  courierCode: string | null;
  courierService: string | null;
  courierName: string | null;
  shippingCost: number;
  subtotal: number;
  discountAmount: number;
  pointsDiscount: number;
  totalAmount: number;
  couponCode: string | null;
  pointsUsed: number;
  pointsEarned: number;
  customerNote: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  paymentExpiresAt: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  userId: string | null;
  items: OrderItem[];
  user: User | null;
  statusHistory: OrderHistoryEntry[];
}

const VALID_TRANSITIONS_ADMIN: Record<string, { status: string; label: string }[]> = {
  paid: [
    { status: 'processing', label: 'Proses' },
    { status: 'cancelled', label: 'Batalkan' },
  ],
  processing: [
    { status: 'packed', label: 'Kemas' },
    { status: 'cancelled', label: 'Batalkan' },
  ],
  packed: [{ status: 'shipped', label: 'Kirim' }],
  shipped: [{ status: 'delivered', label: 'Terima' }],
};

const NEXT_STATUS: Record<string, string> = {
  paid: 'processing',
  processing: 'packed',
  packed: 'shipped',
  shipped: 'delivered',
};

const STATUS_TIMELINE: string[] = [
  'pending_payment',
  'paid',
  'processing',
  'packed',
  'shipped',
  'delivered',
];

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Menunggu Pembayaran',
  paid: 'Sudah Dibayar',
  processing: 'Diproses',
  packed: 'Dikemas',
  shipped: 'Dikirim',
  delivered: 'Diterima',
  cancelled: 'Dibatalkan',
  refunded: 'Dikembalikan',
};

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

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [orderId, setOrderId] = useState<string>('');
  const [isClientReady, setIsClientReady] = useState(false);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [estimatedDays, setEstimatedDays] = useState('');
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    params.then(p => {
      setOrderId(p.id);
      setIsClientReady(true);
    });
  }, [params]);

  useEffect(() => {
    if (!orderId) return;

    async function fetchData() {
      try {
        const orderRes = await fetch(`/api/admin/orders/${orderId}`);
        if (!orderRes.ok) throw new Error('Failed to fetch order');
        const orderData = await orderRes.json();
        setOrder(orderData.data);
        if (orderData.data?.trackingNumber) setTrackingNumber(orderData.data.trackingNumber);
      } catch {
        setError('Gagal memuat detail pesanan');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [orderId]);

  // Auto-generate tracking URL when tracking number or courier changes
  useEffect(() => {
    if (trackingNumber && order?.courierCode) {
      const url = buildTrackingUrl(order.courierCode, trackingNumber);
      if (url) setTrackingUrl(url);
    }
  }, [trackingNumber, order?.courierCode]);

  async function handleStatusUpdate(newStatus: string) {
    if (!confirm(`Yakin ubah status ke "${STATUS_LABELS[newStatus]}"?`)) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          trackingNumber: trackingNumber || undefined,
          trackingUrl: trackingUrl || undefined,
          estimatedDays: estimatedDays || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal mengupdate status');
      }

      const updated = await fetch(`/api/admin/orders/${orderId}`).then(r => r.json());
      setOrder(updated.data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengupdate status');
    } finally {
      setIsUpdating(false);
    }
  }

  if (!isClientReady) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Memuat detail pesanan...</div>;
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/orders" className="p-2 hover:bg-admin-content rounded-lg">
            ←
          </Link>
          <h1 className="text-2xl font-bold">Detail Pesanan</h1>
        </div>
        <div className="bg-white rounded-lg border border-admin-border p-6 text-center text-red-500">
          {error ?? 'Pesanan tidak ditemukan'}
        </div>
      </div>
    );
  }

  const currentRole = session?.user?.role ?? '';
  const canUpdateStatus = ['superadmin', 'owner', 'warehouse'].includes(currentRole);

  const rawTransitions = VALID_TRANSITIONS_ADMIN[order.status] || [];
  const allowedTransitions = currentRole === 'warehouse'
    ? rawTransitions.filter(t => t.status === 'shipped')
    : rawTransitions;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/orders" className="p-2 hover:bg-admin-content rounded-lg text-lg">
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
            <p className="text-sm text-gray-500">{formatWIB(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex px-3 py-1.5 text-sm font-semibold rounded ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
          {order.paymentExpiresAt && order.status === 'pending_payment' && (
            <span className="text-xs text-gray-500">
              Kadaluarsa: {formatWIB(order.paymentExpiresAt)}
            </span>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      {order.status === 'cancelled' ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <span className="text-red-600 font-semibold text-lg">Pesanan Dibatalkan</span>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-admin-border p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Timeline Pesanan</h2>
          <div className="flex items-start">
          {STATUS_TIMELINE.map((step, idx) => {
            const currentStepIdx = STATUS_TIMELINE.indexOf(order.status);
            const isCompleted = idx < currentStepIdx;
            const isCurrent = order.status === step;
            return (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCompleted ? 'bg-green-500 text-white' : isCurrent ? 'bg-brand-red text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className={`mt-1 text-xs text-center ${isCurrent ? 'text-brand-red font-medium' : 'text-gray-500'}`}>
                    {STATUS_LABELS[step]}
                  </span>
                </div>
                {idx < STATUS_TIMELINE.length - 1 && (
                  <div className={`flex-1 h-0.5 mt-4 ${idx < currentStepIdx ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            );
          })}
          </div>
          {order.statusHistory.length > 0 && (
            <div className="mt-4 pt-4 border-t space-y-2">
              {order.statusHistory.map((h) => (
                <div key={h.id} className="text-xs text-gray-500 flex justify-between">
                  <span>{STATUS_LABELS[h.toStatus] ?? h.toStatus}</span>
                  <span>{formatWIB(h.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Items */}
        <div className="bg-white rounded-lg border border-admin-border p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Item Pesanan</h2>
          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
                {item.productImageUrl && (
                  <div className="w-14 h-14 rounded-lg bg-brand-cream overflow-hidden flex-shrink-0">
                    <Image src={item.productImageUrl} alt={item.productNameId} width={56} height={56} className="object-cover w-full h-full" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{item.productNameId}</p>
                  <p className="text-xs text-gray-500">{item.variantNameId} · SKU: {item.sku}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium">{item.quantity}x</p>
                  <p className="text-xs text-gray-500">{formatIDR(item.unitPrice)}</p>
                  <p className="text-sm font-bold text-brand-red">{formatIDR(item.subtotal)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="mt-4 pt-4 border-t space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatIDR(order.subtotal)}</span>
            </div>
            {order.pointsDiscount > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Points</span>
                <span>-{formatIDR(order.pointsDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Ongkos Kirim</span>
              <span>{formatIDR(order.shippingCost)}</span>
            </div>
            {order.couponCode && order.discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Kupon ({order.couponCode})</span>
                <span>-{formatIDR(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span className="text-brand-red">{formatIDR(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Customer & Shipping Info */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg border border-admin-border p-6">
            <h2 className="font-semibold text-gray-700 mb-4">Info Pelanggan</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Nama</dt>
                <dd className="font-medium">{order.recipientName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium">{order.recipientEmail}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Telepon</dt>
                <dd className="font-medium">{order.recipientPhone}</dd>
              </div>
              {order.user && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">User ID</dt>
                    <dd className="font-mono text-xs">{order.userId}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Poin</dt>
                    <dd className="font-medium text-amber-600">{order.user.pointsBalance ?? 0} pts</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {/* Shipping Info */}
          {order.deliveryMethod === 'delivery' && (
            <div className="bg-white rounded-lg border border-admin-border p-6">
              <h2 className="font-semibold text-gray-700 mb-4">Alamat Pengiriman</h2>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Alamat</dt>
                  <dd className="font-medium mt-1">{order.addressLine}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Kota</dt>
                  <dd className="font-medium">{order.city}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Provinsi</dt>
                  <dd className="font-medium">{order.province}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Kode Pos</dt>
                  <dd className="font-medium">{order.postalCode}</dd>
                </div>
              </dl>
            </div>
          )}

          {/* Courier Info */}
          {order.courierName && (
            <div className="bg-white rounded-lg border border-admin-border p-6">
              <h2 className="font-semibold text-gray-700 mb-4">Kurir</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Kurir</dt>
                  <dd className="font-medium">{order.courierName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Service</dt>
                  <dd className="font-medium">{order.courierService}</dd>
                </div>
                {order.trackingNumber && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">No. Resi</dt>
                    <dd className="font-medium">{order.trackingNumber}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">Ongkir</dt>
                  <dd className="font-medium">{formatIDR(order.shippingCost)}</dd>
                </div>
              </dl>
            </div>
          )}

          {/* Pickup Info */}
          {order.deliveryMethod === 'pickup' && (
            <div className="bg-white rounded-lg border border-admin-border p-6">
              <h2 className="font-semibold text-gray-700 mb-4">Info Pickup</h2>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Kode Pengambilan</p>
                <p className="font-mono text-3xl font-bold text-brand-red">
                  {order.orderNumber}
                </p>
              </div>
            </div>
          )}

          {/* Tracking Number Input (warehouse/superadmin/owner) */}
          {canUpdateStatus && (order.status === 'packed' || order.status === 'shipped') && (
            <div className="bg-white rounded-lg border border-admin-border p-6">
              <h2 className="font-semibold text-gray-700 mb-4">Input Resi</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Nomor Resi</label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Masukkan nomor resi"
                    className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">URL Tracking (opsional)</label>
                  <input
                    type="text"
                    value={trackingUrl}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Estimasi Hari</label>
                  <input
                    type="text"
                    value={estimatedDays}
                    onChange={(e) => setEstimatedDays(e.target.value)}
                    placeholder="2-3 hari"
                    className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm"
                  />
                </div>
              </div>
              {order.status === 'shipped' && (
                <button
                  onClick={async () => {
                    if (!trackingNumber.trim()) {
                      alert('Nomor resi harus diisi');
                      return;
                    }
                    setIsUpdating(true);
                    try {
                      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          status: 'shipped',
                          trackingNumber,
                          trackingUrl: trackingUrl || undefined,
                          estimatedDays: estimatedDays || undefined,
                        }),
                      });
                      if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error || 'Gagal menyimpan resi');
                      }
                      const updated = await fetch(`/api/admin/orders/${orderId}`).then(r => r.json());
                      setOrder(updated.data);
                    } catch (err) {
                      alert(err instanceof Error ? err.message : 'Gagal menyimpan resi');
                    } finally {
                      setIsUpdating(false);
                    }
                  }}
                  className="w-full h-10 mt-4 bg-brand-red text-white text-sm font-medium rounded-lg hover:bg-brand-red-dark transition-colors disabled:opacity-50"
                >
                  Simpan Resi
                </button>
              )}
              {order.status === 'packed' && (
                <p className="text-sm text-text-secondary mt-3">
                  Klik "Kirim" di bawah untuk menyimpan resi dan ubah status ke Dikirim.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {order.customerNote && (
        <div className="bg-white rounded-lg border border-admin-border p-6">
          <h2 className="font-semibold text-gray-700 mb-2">Catatan Pelanggan</h2>
          <p className="text-sm text-gray-600">{order.customerNote}</p>
        </div>
      )}

      {/* Status Update Buttons */}
      {canUpdateStatus && allowedTransitions.length > 0 && (
        <div className="bg-white rounded-lg border border-admin-border p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Update Status</h2>
          <div className="flex flex-wrap gap-3">
            {NEXT_STATUS[order.status] && (
              <button
                onClick={() => handleStatusUpdate(NEXT_STATUS[order.status])}
                disabled={isUpdating}
                className="h-12 px-6 bg-brand-red text-white font-bold rounded-lg hover:bg-brand-red-dark transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isUpdating ? 'Memproses...' : `▶ Tandai sebagai "${STATUS_LABELS[NEXT_STATUS[order.status]]}"`}
              </button>
            )}
            {allowedTransitions.map((t) => (
              <button
                key={t.status}
                onClick={() => handleStatusUpdate(t.status)}
                disabled={isUpdating}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {isUpdating ? 'Memproses...' : t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}