import { requireRole } from '@/lib/auth/check-role';
import ProductEditClient from './ProductEditClient';

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['superadmin', 'owner']);
  const { id } = await params;
  return <ProductEditClient productId={id} />;
}