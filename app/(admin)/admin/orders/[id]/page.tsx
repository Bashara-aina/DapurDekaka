import { requireRole } from '@/lib/auth/check-role';
import { auth } from '@/lib/auth';
import { notFound } from 'next/navigation';
import OrderDetailClient from './OrderDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const session = await requireRole(['superadmin', 'owner', 'warehouse']);
  const userRole = (session.user as { role?: string }).role ?? 'owner';
  const { id } = await params;

  if (!id) {
    notFound();
  }

  return <OrderDetailClient orderId={id} userRole={userRole} />;
}