import { requireRole } from '@/lib/auth/check-role';
import { BlogNewClient } from './BlogNewClient';

export default async function AdminBlogNewPage() {
  await requireRole(['superadmin', 'owner']);
  return <BlogNewClient />;
}