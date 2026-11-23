import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { eq, and, ne } from 'drizzle-orm';
import { orders } from '@/lib/db/schema';
import { getSetting } from '@/lib/settings/get-settings';
import { PickupGate } from './PickupGate';

interface Props {
  params: Promise<{ orderNumber: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  const t = await getTranslations('checkout');
  return {
    title: t('pickupMetaTitle', { orderNumber }),
    description: t('pickupMetaDescription'),
  };
}

export default async function OrderPickupPage({ params }: Props): Promise<React.ReactElement> {
  const { orderNumber } = await params;
  const t = await getTranslations('checkout');

  const [order, storeAddress, whatsappNumber, openingHours] = await Promise.all([
    db.query.orders.findFirst({
      where: and(eq(orders.orderNumber, orderNumber), ne(orders.status, 'cancelled')),
      columns: {
        id: true,
        deliveryMethod: true,
        status: true,
      },
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

  if (
    order.status === 'pending_payment' ||
    order.status === 'cancelled' ||
    order.status === 'refunded'
  ) {
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
            <span className="text-sm text-text-secondary">{t('pickupNavLabel')}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h1 className="font-display text-2xl font-bold text-text-primary mb-2">
            {t('pickupShowCodeTitle')}
          </h1>
          <p className="text-text-secondary">{t('pickupShowCodeSubtitle')}</p>
        </div>

        <PickupGate
          orderNumber={orderNumber}
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
            {t('viewOrderDetails')}
          </Link>
        </div>
      </div>
    </div>
  );
}
