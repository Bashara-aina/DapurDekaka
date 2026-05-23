import { requireAdmin } from '@/lib/auth/require-admin';
import CustomerDetailClient from './CustomerDetailClient';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(['superadmin', 'owner']);
  const { id } = await params;
  return <CustomerDetailClient customerId={id} />;
}