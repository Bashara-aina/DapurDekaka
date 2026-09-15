import { requireRole } from '@/lib/auth/check-role';
import BlogCategoriesClient from './BlogCategoriesClient';

export default async function BlogCategoriesPage() {
  await requireRole(['superadmin', 'owner']);
  return <BlogCategoriesClient />;
}
