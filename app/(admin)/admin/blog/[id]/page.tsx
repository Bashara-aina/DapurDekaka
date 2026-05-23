import { requireRole } from '@/lib/auth/check-role';
import { BlogEditClient } from './BlogEditClient';

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminBlogEditPage({ params }: PageProps) {
  await requireRole(['superadmin', 'owner']);
  const { id } = await params;
  return <BlogEditClient params={Promise.resolve({ id })} />;
}