'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Package, Truck, MapPin, FileText, Clock, Copy, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { OrderItemsList } from '@/components/store/orders/OrderItemsList';
import { OrderTimeline } from '@/components/store/orders/OrderTimeline';
import { TrackingInfo } from '@/components/store/orders/TrackingInfo';

interface OrderItem {
  productNameId: string;
  variantNameId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  productImageUrl: string | null;
}

interface OrderDetail {
  orderNumber: string;
  status: string;
  createdAt: string;
  subtotal: number;
  discountAmount: number;
  pointsDiscount: number;
  shippingCost: number;
  totalAmount: number;
  recipientName: string;
  recipientPhone: string;
  addressLine: string | null;
  district: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  deliveryMethod: string;
  courierName: string | null;
  trackingNumber: string | null;
  items: OrderItem[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1 hover:text-brand-red transition-colors" aria-label="Copy">
      {copied ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

import { useState } from 'react';

export default function B2BOrderDetailClient({ orderNumber }: { orderNumber: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const { data: order, isLoading } = useQuery<OrderDetail | null>({
    queryKey: ['b2b', 'order', orderNumber],
    queryFn: async () => {
      const res = await fetch(`/api/b2b/orders/${orderNumber}`);
      const json = await res.json();
      return json.success ? json.data : null;
    },
    enabled: !!session?.user,
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/b2b/account/orders');
    }
  }, [status, router]);

  const formatIDR = (amount: number) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);

  if (status === 'loading' || isLoading) {
    return (
      <div className="bg-brand-cream min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-red animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-brand-cream min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary mb-4">Pesanan tidak ditemukan</p>
          <Link href="/b2b/account/orders" className="text-brand-red hover:underline">
            Kembali ke Riwayat Pesanan
          </Link>
        </div>
      </div>
    );
  }

  const currentStepIndex = order.status === 'cancelled'
    ? -1
    : ['pending_payment', 'paid', 'processing', 'packed', 'shipped', 'delivered'].indexOf(order.status);

  return (
    <div className="bg-brand-cream min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white border-b border-brand-cream-dark py-6 px-4 sticky top-0 z-10">
        <div className="container mx-auto">
          <Link
            href="/b2b/account/orders"
            className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-brand-red transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-bold text-text-primary">{order.orderNumber}</h1>
                <CopyButton text={order.orderNumber} />
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {new Date(order.createdAt).toLocaleDateString('id-ID', {
                  day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })} WIB
              </p>
            </div>
            <span className={`inline-flex px-3 py-1.5 rounded-lg text-sm font-bold w-fit
              ${order.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-700' : ''}
              ${order.status === 'paid' ? 'bg-blue-100 text-blue-700' : ''}
              ${order.status === 'processing' ? 'bg-purple-100 text-purple-700' : ''}
              ${order.status === 'packed' ? 'bg-cyan-100 text-cyan-700' : ''}
              ${order.status === 'shipped' ? 'bg-green-100 text-green-700' : ''}
              ${order.status === 'delivered' ? 'bg-green-100 text-green-700' : ''}
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
      </div>

      <div className="px-4 py-6 container mx-auto space-y-4">
        {/* Order Items */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-display text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-red" />
            Item Pesanan
          </h2>
          <OrderItemsList items={order.items} />
        </div>

        {/* Order Timeline */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-display text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-red" />
            Status Pesanan
          </h2>
          <OrderTimeline
            steps={[
              { label: 'Pesanan Dibuat' },
              { label: 'Menunggu Pembayaran' },
              { label: 'Pembayaran Diterima' },
              { label: 'Sedang Diproses' },
              { label: 'Dikemas' },
              { label: 'Sedang Dikirim' },
              { label: 'Selesai' },
            ]}
            currentStepIndex={currentStepIndex}
            cancelled={order.status === 'cancelled'}
          />
        </div>

        {/* Tracking Info */}
        {(order.status === 'shipped' || order.status === 'delivered') && order.trackingNumber && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-display text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-brand-red" />
              Info Pengiriman
            </h2>
            <TrackingInfo trackingNumber={order.trackingNumber} courierName={order.courierName} />
          </div>
        )}

        {/* Delivery Address */}
        {order.deliveryMethod === 'delivery' && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-display text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-red" />
              Alamat Pengiriman
            </h2>
            <div className="text-sm">
              <p className="font-medium text-text-primary">{order.recipientName}</p>
              <p className="text-text-secondary">{order.recipientPhone}</p>
              {order.addressLine && (
                <p className="text-text-secondary mt-2">
                  {order.addressLine}, {order.district}, {order.city}
                </p>
              )}
              {order.province && order.postalCode && (
                <p className="text-text-secondary">
                  {order.province} {order.postalCode}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-display text-base font-semibold text-text-primary mb-4">
            Ringkasan Pembayaran
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Subtotal</span>
              <span>{formatIDR(order.subtotal)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Diskon</span>
                <span>-{formatIDR(order.discountAmount)}</span>
              </div>
            )}
            {order.pointsDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Poin Digunakan</span>
                <span>-{formatIDR(order.pointsDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-text-secondary">Ongkos Kirim</span>
              <span>{formatIDR(order.shippingCost)}</span>
            </div>
            <div className="border-t border-brand-cream-dark pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-brand-red">{formatIDR(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Download Receipt */}
        {order.status !== 'pending_payment' && order.status !== 'cancelled' && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <a
              href={`/api/orders/${order.orderNumber}/receipt`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-12 bg-brand-red text-white font-bold rounded-lg hover:bg-brand-red-dark transition-colors"
            >
              <FileText className="w-5 h-5" />
              Download Bukti Pembayaran
            </a>
          </div>
        )}
      </div>
    </div>
  );
}