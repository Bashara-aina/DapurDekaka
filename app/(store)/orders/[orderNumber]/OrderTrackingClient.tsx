'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';
import { OrderTimeline } from '@/components/store/orders/OrderTimeline';
import { OrderItemsList } from '@/components/store/orders/OrderItemsList';
import { TrackingInfo } from '@/components/store/orders/TrackingInfo';
import { PickupInvitation } from '@/components/store/orders/PickupInvitation';
import { PaymentSuccessOverlay } from '@/components/store/checkout/PaymentSuccessOverlay';

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

interface Order {
  orderNumber: string;
  status: string;
  recipientName: string;
  recipientPhone: string;
  deliveryMethod: string;
  addressLine: string | null;
  district: string | null;
  city: string | null;
  province: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  subtotal: number;
  discountAmount: number;
  pointsDiscount: number;
  shippingCost: number;
  totalAmount: number;
  paymentExpiresAt: Date | null;
  items: Array<{
    id: string;
    productNameId: string;
    variantNameId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    productImageUrl: string | null;
  }>;
}

interface OrderTrackingClientProps {
  order: Order;
}

export function OrderTrackingClient({ order }: OrderTrackingClientProps) {
  const searchParams = useSearchParams();
  const paymentFinish = searchParams.get('payment') === 'finish';

  if (paymentFinish) {
    return <PaymentSuccessOverlay orderNumber={order.orderNumber} />;
  }

  const timelineInfo = STATUS_TIMELINE[order.status] ?? { label: order.status, index: 0 };
  const currentIndex = order.status === 'cancelled' ? 0 : timelineInfo.index;

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
              <p className="font-bold text-xl text-brand-red">{order.orderNumber}</p>
            </div>
            <div
              className={`px-3 py-1 rounded-pill text-sm font-medium ${
                order.status === 'cancelled'
                  ? 'bg-error-light text-error'
                  : order.status === 'delivered'
                    ? 'bg-success-light text-success'
                    : 'bg-warning-light text-warning'
              }`}
            >
              {timelineInfo.label}
            </div>
          </div>

          {order.status === 'pending_payment' && (
            <p className="text-xs text-text-secondary">
              Selesaikan pembayaran sebelum {order.paymentExpiresAt ? formatWIB(new Date(order.paymentExpiresAt)) : '15 menit'}
            </p>
          )}
        </div>

        {/* Timeline */}
        {order.status !== 'cancelled' && (
          <div className="bg-white rounded-card p-6 shadow-card mb-6">
            <h3 className="font-semibold mb-4">Status Pesanan</h3>
            <OrderTimeline steps={TIMELINE_STEPS} currentStepIndex={currentIndex} />
          </div>
        )}

        {/* Order items */}
        <div className="bg-white rounded-card p-6 shadow-card mb-6">
          <OrderItemsList items={order.items} />
        </div>

        {/* Delivery info */}
        <div className="bg-white rounded-card p-6 shadow-card mb-6">
          <h3 className="font-semibold mb-4">Informasi Pengiriman</h3>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Penerima</span>
              <span className="font-medium">{order.recipientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">No. HP</span>
              <span className="font-medium">{order.recipientPhone}</span>
            </div>
            {order.deliveryMethod === 'delivery' && order.addressLine && (
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

        {/* Tracking info (for shipped orders) */}
        {order.trackingNumber && (
          <div className="mb-6">
            <TrackingInfo
              courierName={order.courierName}
              trackingNumber={order.trackingNumber}
              trackingUrl={order.trackingUrl}
            />
          </div>
        )}

        {/* Pickup invitation (for pickup orders that are paid) */}
        {order.deliveryMethod === 'pickup' && order.status !== 'pending_payment' && order.status !== 'cancelled' && (
          <div className="mb-6">
            <PickupInvitation orderNumber={order.orderNumber} />
          </div>
        )}

        {/* Order summary */}
        <div className="bg-white rounded-card p-6 shadow-card">
          <h3 className="font-semibold mb-4">Ringkasan Pembayaran</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Subtotal</span>
              <span>{formatIDR(order.subtotal)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-success">
                <span>Diskon</span>
                <span>-{formatIDR(order.discountAmount)}</span>
              </div>
            )}
            {order.pointsDiscount > 0 && (
              <div className="flex justify-between text-success">
                <span>Points Digunakan</span>
                <span>-{formatIDR(order.pointsDiscount)}</span>
              </div>
            )}
            {order.shippingCost > 0 && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Ongkos Kirim</span>
                <span>{formatIDR(order.shippingCost)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-brand-cream-dark">
              <span>Total</span>
              <span className="text-brand-red">{formatIDR(order.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}