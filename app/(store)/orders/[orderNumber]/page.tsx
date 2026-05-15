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

  // Just verify order exists — do NOT expose order data before email verification
  const exists = await db.select({ id: orders.id })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);

  if (exists.length === 0) {
    notFound();
  }

  return <OrderTrackingClient orderNumber={orderNumber} />;
}