import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { eq, and, ne } from 'drizzle-orm';
import { orders } from '@/lib/db/schema';
import { PickupInvitation } from '@/components/store/orders/PickupInvitation';
import { getSetting } from '@/lib/settings/get-settings';

interface Props {
  params: Promise<{ orderNumber: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  return {
    title: `Pengambilan Pesanan ${orderNumber} — Dapur Dekaka`,
    description: 'Instruksi pengambilan pesanan frozen food di toko',
  };
}

export default async function OrderPickupPage({ params }: Props) {
  const { orderNumber } = await params;

  const [order, storeAddress, whatsappNumber, openingHours] = await Promise.all([
    db.query.orders.findFirst({
      where: and(
        eq(orders.orderNumber, orderNumber),
        ne(orders.status, 'cancelled')
      ),
    }),
    getSetting<string>('store_address').catch(() => null),
    getSetting<string>('store_whatsapp_number').catch(() => null),
    getSetting<string>('store_opening_hours').catch(() => null),
  ]);

  if (!order) {
    notFound();
  }

  if (order.deliveryMethod !== 'pickup') {
    notFound();
  }

  // PRD §5.6: invitation only after payment is confirmed. Never show
  // "Siap Diambil" for pending_payment/cancelled/refunded orders.
  if (order.status === 'pending_payment' || order.status === 'cancelled' || order.status === 'refunded') {
    notFound();
  }

  const address = storeAddress ?? '';
  const mapsUrl = address
    ? `https://maps.google.com/?q=${encodeURIComponent(address)}`
    : '';
  const wa = whatsappNumber ?? '';
  const hours = openingHours ?? '';

  return (
    <div className="min-h-screen bg-brand-cream pb-20 md:pb-0">
      <div className="bg-white border-b border-brand-cream-dark sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="font-display text-xl font-bold">
              Dapur Dekaka
            </Link>
            <span className="text-sm text-text-secondary">Pengambilan</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
            Tunjukkan Kode Ini di Toko
          </h1>
          <p className="text-text-secondary">
            Pembayaran terkonfirmasi — pesanan Anda sedang disiapkan. Tunjukkan kode {order.orderNumber} ke staff toko.
          </p>
        </div>

        <PickupInvitation
          orderNumber={order.orderNumber}
          storeAddress={address}
          googleMapsUrl={mapsUrl}
          whatsappNumber={wa}
          openingHours={hours}
        />

        <div className="mt-6 text-center">
          <Link
            href={`/orders/${orderNumber}`}
            className="text-sm text-brand-red hover:underline"
          >
            Lihat Detail Pesanan
          </Link>
        </div>
      </div>
    </div>
  );
}