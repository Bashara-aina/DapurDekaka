import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { orders } from '@/lib/db/schema';
import { OrderTrackingClient } from './OrderTrackingClient';

interface Props {
  params: Promise<{ orderNumber: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  return {
    title: `Lacak Pesanan ${orderNumber} — Dapur Dekaka`,
    description: 'Lacak status pesanan frozen food Anda',
  };
}

export default async function OrderTrackingPage({ params }: Props) {
  const { orderNumber } = await params;

  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, orderNumber),
    with: { items: true },
  });

  if (!order) {
    notFound();
  }

  return <OrderTrackingClient order={order} />;
}