'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Mail, Lock, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { OrderTimeline } from '@/components/store/orders/OrderTimeline';

interface Order {
  orderNumber: string;
  status: string;
  deliveryMethod: string;
  createdAt: string;
  recipientName?: string;
  recipientPhone?: string;
  addressLine?: string;
  district?: string;
  city?: string;
  province?: string;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  subtotal?: number;
  discountAmount?: number;
  pointsDiscount?: number;
  shippingCost?: number;
  totalAmount?: number;
  pointsEarned?: number;
  paidAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  items?: Array<{
    productNameId: string;
    variantNameId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    productImageUrl: string | null;
  }>;
}

interface VerifiedOrder extends Order {
  verified: true;
  requiresEmailVerification?: false;
}

const STATUS_TIMELINE: Record<string, { label: string; index: number }> = {
  pending_payment: { label: 'Menunggu Pembayaran', index: 0 },
  paid: { label: 'Pembayaran Diterima', index: 1 },
  processing: { label: 'Sedang Diproses', index: 2 },
  packed: { label: 'Siap Dikirim', index: 3 },
  shipped: { label: 'Dalam Pengiriman', index: 4 },
  delivered: { label: 'Selesai', index: 5 },
  cancelled: { label: 'Dibatalkan', index: 0 },
};

const TIMELINE_STEPS = [
  { label: 'Pesanan Dibuat', description: 'Checkout selesai, menunggu pembayaran' },
  { label: 'Pembayaran Diterima', description: 'Pembayaran berhasil diverifikasi' },
  { label: 'Sedang Diproses', description: 'Tim kami sedang menyiapkan pesanan' },
  { label: 'Siap Dikirim', description: 'Pesanan dikemas dan siap dikirim' },
  { label: 'Dalam Pengiriman', description: 'Sedang diantar oleh kurir' },
  { label: 'Selesai', description: 'Pesanan telah diterima' },
];

const formatIDR = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatWIB = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
};

export function OrderTrackingClient({
  orderNumber,
}: {
  orderNumber: string;
}) {
  const [email, setEmail] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [preVerifyStatus, setPreVerifyStatus] = useState<string | null>(null);

  // Status comes from verified order data after email verification
  const currentStatus = order?.status ?? preVerifyStatus ?? 'pending_payment';
  const timelineInfo = STATUS_TIMELINE[currentStatus] ?? { label: currentStatus, index: 0 };
  const currentIndex = currentStatus === 'cancelled' ? 0 : timelineInfo.index;

  // Auto-verify for logged-in users who own the order
  useEffect(() => {
    async function tryAutoVerify() {
      try {
        const res = await fetch(`/api/orders/${orderNumber}`);
        const data = await res.json();
        if (data?.order && data?.verified) {
          setOrder(data.order as Order);
          setVerified(true);
        }
      } catch {
        // Not logged in or not their order — show the email form
      }
    }
    tryAutoVerify();
  }, [orderNumber]);

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsVerifying(true);
    setError('');

    try {
      const res = await fetch(`/api/orders/${orderNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.success && data.data?.verified) {
        setOrder(data.data.order as Order);
        setVerified(true);
      } else {
        setError(data.error || 'Email tidak cocok dengan pesanan');
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    }

    setIsVerifying(false);
  };

  return (
    <div className="min-h-screen bg-brand-cream pb-20 md:pb-0">
      {/* Header */}
      <div className="bg-white border-b border-brand-cream-dark sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="font-display text-xl font-bold">
              Dapur Dekaka
            </Link>
            <span className="text-sm text-text-secondary">Lacak Pesanan</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Order number + status */}
        <div className="bg-white rounded-card p-6 shadow-card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-text-secondary mb-1">Nomor Pesanan</p>
              <p className="font-bold text-xl text-brand-red">{orderNumber}</p>
            </div>
            <div
              className={cn(
                'px-3 py-1 rounded-pill text-sm font-medium',
                currentStatus === 'cancelled'
                  ? 'bg-error-light text-error'
                  : currentStatus === 'delivered'
                    ? 'bg-success-light text-success'
                    : 'bg-warning-light text-warning'
              )}
            >
              {timelineInfo.label}
            </div>
          </div>
        </div>

        {/* Email verification gate */}
        {!verified && (
          <div className="bg-white rounded-card p-6 shadow-card mb-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-brand-red" />
              </div>
              <h2 className="font-display text-xl font-bold text-text-primary mb-2">
                Verifikasi Email
              </h2>
              <p className="text-text-secondary text-sm">
                Masukkan email yang digunakan saat checkout untuk melihat detail pesanan
              </p>
            </div>

            <form onSubmit={handleVerifyEmail} className="max-w-sm mx-auto">
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  required
                  className="w-full h-12 px-4 border border-brand-cream-dark rounded-button focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                />
              </div>

              {error && (
                <p className="text-error text-sm mb-4 text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full h-12 bg-brand-red text-white font-bold rounded-button hover:bg-brand-red-dark transition-colors disabled:opacity-50"
              >
                {isVerifying ? 'Memverifikasi...' : 'Verifikasi'}
              </button>
            </form>
          </div>
        )}

        {/* Verified order details */}
        {verified && order && (
          <>
            {/* Timeline using OrderTimeline component */}
            {currentStatus !== 'cancelled' && (
              <div className="bg-white rounded-card p-6 shadow-card mb-6">
                <h3 className="font-semibold mb-4">Status Pesanan</h3>
                <OrderTimeline
                  steps={TIMELINE_STEPS}
                  currentStepIndex={currentIndex}
                />
              </div>
            )}

            {/* Order items */}
            {order.items && order.items.length > 0 && (
              <div className="bg-white rounded-card p-6 shadow-card mb-6">
                <h3 className="font-semibold mb-4">Item Pesanan</h3>
                <div className="space-y-3">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      {item.productImageUrl && (
                        <div className="w-12 h-12 rounded bg-brand-cream overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.productImageUrl}
                            alt={item.productNameId}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">{item.productNameId}</p>
                        <p className="text-xs text-text-secondary">{item.variantNameId} × {item.quantity}</p>
                      </div>
                      <p className="text-sm font-bold text-brand-red">{formatIDR(item.subtotal)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery info */}
            <div className="bg-white rounded-card p-6 shadow-card mb-6">
              <h3 className="font-semibold mb-4">Informasi Pengiriman</h3>

              <div className="space-y-3 text-sm">
                {order.recipientName && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Penerima</span>
                    <span className="font-medium">{order.recipientName}</span>
                  </div>
                )}
                {order.recipientPhone && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">No. HP</span>
                    <span className="font-medium">{order.recipientPhone}</span>
                  </div>
                )}
                {order.addressLine && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Alamat</span>
                      <span className="font-medium text-right max-w-[60%]">
                        {order.addressLine}, {order.district}, {order.city}, {order.province}
                      </span>
                    </div>
                    {order.courierName && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Kurir</span>
                        <span className="font-medium">{order.courierName}</span>
                      </div>
                    )}
                    {order.trackingNumber && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">No. Resi</span>
                        <span className="font-medium">{order.trackingNumber}</span>
                      </div>
                    )}
                  </>
                )}
                {order.deliveryMethod === 'pickup' && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Metode</span>
                    <span className="font-medium">Ambil di Toko</span>
                  </div>
                )}
              </div>
            </div>

            {/* Order summary */}
            <div className="bg-white rounded-card p-6 shadow-card">
              <h3 className="font-semibold mb-4">Ringkasan Pembayaran</h3>
              <div className="space-y-2 text-sm">
                {order.subtotal !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Subtotal</span>
                    <span>{formatIDR(order.subtotal)}</span>
                  </div>
                )}
                {order.discountAmount !== undefined && order.discountAmount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Diskon</span>
                    <span>-{formatIDR(order.discountAmount)}</span>
                  </div>
                )}
                {order.pointsDiscount !== undefined && order.pointsDiscount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Points Digunakan</span>
                    <span>-{formatIDR(order.pointsDiscount)}</span>
                  </div>
                )}
                {order.shippingCost !== undefined && order.shippingCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Ongkos Kirim</span>
                    <span>{formatIDR(order.shippingCost)}</span>
                  </div>
                )}
                {order.totalAmount !== undefined && (
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-brand-cream-dark">
                    <span>Total</span>
                    <span className="text-brand-red">{formatIDR(order.totalAmount)}</span>
                  </div>
                )}
                {order.pointsEarned !== undefined && order.pointsEarned > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Poin Didapat</span>
                    <span>+{order.pointsEarned} poin</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Minimal info for unverified - just status */}
        {!verified && (
          <div className="bg-white rounded-card p-6 shadow-card">
            <div className="text-center">
              <div className="w-16 h-16 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-text-muted" />
              </div>
              <h3 className="font-semibold mb-2">Detail Pesanan</h3>
              <p className="text-sm text-text-secondary">
                Verifikasi email untuk melihat detail pesanan lengkap
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}