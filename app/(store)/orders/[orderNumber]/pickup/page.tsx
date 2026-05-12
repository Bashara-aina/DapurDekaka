import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { eq, and, ne } from 'drizzle-orm';
import { orders } from '@/lib/db/schema';
import { PickupInvitation } from '@/components/store/orders/PickupInvitation';

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

  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.orderNumber, orderNumber),
      ne(orders.status, 'cancelled')
    ),
  });

  if (!order) {
    notFound();
  }

  if (order.deliveryMethod !== 'pickup') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-brand-cream pb-20 md:pb-0">
      {/* Header */}
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
            Pesanan Anda Siap Diambil!
          </h1>
          <p className="text-text-secondary">
            Setelah pembayaran terkonfirmasi, pesanan Anda akan disiapkan.
          </p>
        </div>

        <PickupInvitation orderNumber={order.orderNumber} />

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