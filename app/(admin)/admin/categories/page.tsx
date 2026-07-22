import { requireRole } from '@/lib/auth/check-role';
import CategoriesClient from './CategoriesClient';

export default async function CategoriesPage() {
  await requireRole(['superadmin', 'owner']);
  return <CategoriesClient />;
}