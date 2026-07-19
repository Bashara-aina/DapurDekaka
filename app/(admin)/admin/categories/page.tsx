import { requireAdmin } from '@/lib/auth/require-admin';
import CategoriesClient from './CategoriesClient';

export default async function CategoriesPage() {
  await requireAdmin(['superadmin', 'owner']);
  return <CategoriesClient />;
}