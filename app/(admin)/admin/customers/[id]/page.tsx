import { requireRole } from '@/lib/auth/check-role';
import CustomerDetailClient from './CustomerDetailClient';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['superadmin', 'owner']);
  const { id } = await params;
  return <CustomerDetailClient customerId={id} />;
}