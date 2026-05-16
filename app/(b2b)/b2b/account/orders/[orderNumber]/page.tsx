import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { orders } from '@/lib/db/schema';
import { B2BOrderDetailClient } from './B2BOrderDetailClient';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ orderNumber: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Pesanan ${orderNumber} — B2B Dapur Dekaka` };
}

export default async function B2BOrderDetailPage({ params }: Props) {
  const { orderNumber } = await params;

  const exists = await db.select({ id: orders.id })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);

  if (exists.length === 0) {
    notFound();
  }

  return <B2BOrderDetailClient orderNumber={orderNumber} />;
}