import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, Truck, MapPin, FileText, Check } from 'lucide-react';
import type { Metadata } from 'next';
import { OrderItemsList } from '@/components/store/orders/OrderItemsList';
import { OrderTimeline } from '@/components/store/orders/OrderTimeline';
import { TrackingInfo } from '@/components/store/orders/TrackingInfo';

export const metadata: Metadata = {
  title: 'Detail Pesanan — Dapur Dekaka',
};

interface OrderDetailPageProps {
  params: Promise<{ orderNumber: string }>;
}

export default async function AccountOrderDetailPage({ params }: OrderDetailPageProps) {
  const session = await auth();
  const { orderNumber } = await params;

  if (!session?.user?.id) {
    redirect('/login');
  }

  const order = await db.query.orders.findFirst({
    where: (orders, { eq, and }) => and(
      eq(orders.orderNumber, orderNumber),
    ),
    with: {
      items: true,
      statusHistory: {
        orderBy: (history, { asc }) => [asc(history.createdAt)],
      },
    },
  });

  if (!order) {
    notFound();
  }

  const canView =
    order.userId === session.user.id ||
    session.user.role === 'superadmin' ||
    session.user.role === 'owner';

  if (!canView) {
    redirect('/account/orders');
  }

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-brand-red transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Pesanan Saya
      </Link>

      {/* Order Header */}
      <div className="bg-white rounded-card shadow-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-text-primary">{order.orderNumber}</h1>
            <p className="text-sm text-text-secondary mt-1">
              Tanggal: {new Date(order.createdAt).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })} WIB
            </p>
          </div>
          <span className={`inline-flex px-3 py-1.5 rounded-lg text-sm font-bold w-fit
            ${order.status === 'pending_payment' ? 'bg-warning-light text-warning' : ''}
            ${order.status === 'paid' ? 'bg-info-light text-info' : ''}
            ${order.status === 'processing' ? 'bg-purple-100 text-purple-700' : ''}
            ${order.status === 'packed' ? 'bg-cyan-100 text-cyan-700' : ''}
            ${order.status === 'shipped' ? 'bg-success-light text-success' : ''}
            ${order.status === 'delivered' ? 'bg-success-light text-success' : ''}
            ${order.status === 'cancelled' ? 'bg-gray-100 text-gray-600' : ''}
          `}>
            {order.status === 'pending_payment' && 'Menunggu Pembayaran'}
            {order.status === 'paid' && 'Pembayaran Diterima'}
            {order.status === 'processing' && 'Sedang Diproses'}
            {order.status === 'packed' && 'Dikemas'}
            {order.status === 'shipped' && 'Sedang Dikirim'}
            {order.status === 'delivered' && 'Selesai'}
            {order.status === 'cancelled' && 'Dibatalkan'}
          </span>
        </div>
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-card shadow-card p-6">
        <h2 className="font-display text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Package className="w-5 h-5" />
          Item Pesanan
        </h2>
        <OrderItemsList items={order.items} />
      </div>

      {/* Order Timeline */}
      <div className="bg-white rounded-card shadow-card p-6">
        <h2 className="font-display text-lg font-semibold text-text-primary mb-4">
          Status Pesanan
        </h2>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-lg text-sm font-bold
            ${order.status === 'pending_payment' ? 'bg-warning-light text-warning' : ''}
            ${order.status === 'paid' ? 'bg-info-light text-info' : ''}
            ${order.status === 'processing' ? 'bg-purple-100 text-purple-700' : ''}
            ${order.status === 'packed' ? 'bg-cyan-100 text-cyan-700' : ''}
            ${order.status === 'shipped' ? 'bg-success-light text-success' : ''}
            ${order.status === 'delivered' ? 'bg-success-light text-success' : ''}
            ${order.status === 'cancelled' ? 'bg-gray-100 text-gray-600' : ''}
          `}>
            {order.status === 'pending_payment' && 'Menunggu Pembayaran'}
            {order.status === 'paid' && 'Pembayaran Diterima'}
            {order.status === 'processing' && 'Sedang Diproses'}
            {order.status === 'packed' && 'Dikemas'}
            {order.status === 'shipped' && 'Sedang Dikirim'}
            {order.status === 'delivered' && 'Selesai'}
            {order.status === 'cancelled' && 'Dibatalkan'}
          </span>
          <p className="text-sm text-text-secondary">
            {order.statusHistory.length} update status
          </p>
        </div>
      </div>

      {/* Tracking Info */}
      {order.status === 'shipped' && order.trackingNumber && (
        <div className="bg-white rounded-card shadow-card p-6">
          <h2 className="font-display text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Info Pengiriman
          </h2>
          <TrackingInfo
            trackingNumber={order.trackingNumber}
            courierName={order.courierName}
          />
        </div>
      )}

      {/* Delivery Address */}
      {order.deliveryMethod === 'delivery' && (
        <div className="bg-white rounded-card shadow-card p-6">
          <h2 className="font-display text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Alamat Pengiriman
          </h2>
          <div className="text-sm">
            <p className="font-medium text-text-primary">{order.recipientName}</p>
            <p className="text-text-secondary">{order.recipientPhone}</p>
            <p className="text-text-secondary mt-2">
              {order.addressLine}, {order.district}, {order.city}
            </p>
            <p className="text-text-secondary">
              {order.province} {order.postalCode}
            </p>
          </div>
        </div>
      )}

      {/* Order Summary */}
      <div className="bg-white rounded-card shadow-card p-6">
        <h2 className="font-display text-lg font-semibold text-text-primary mb-4">
          Ringkasan Pembayaran
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Subtotal</span>
            <span className="text-text-primary">{formatIDR(order.subtotal)}</span>
          </div>

          {order.discountAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Diskon</span>
              <span className="text-success">-{formatIDR(order.discountAmount)}</span>
            </div>
          )}

          {order.pointsDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Poin Digunakan</span>
              <span className="text-success">-{formatIDR(order.pointsDiscount)}</span>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Ongkos Kirir</span>
            <span className="text-text-primary">{formatIDR(order.shippingCost)}</span>
          </div>

          <div className="border-t border-brand-cream-dark pt-3 flex justify-between">
            <span className="font-bold text-text-primary">Total</span>
            <span className="font-bold text-brand-red text-lg">{formatIDR(order.totalAmount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}