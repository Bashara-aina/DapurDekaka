import { requireAdmin } from '@/lib/auth/require-admin';
import ProductEditClient from './ProductEditClient';

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(['superadmin', 'owner']);
  const { id } = await params;
  return <ProductEditClient productId={id} />;
}