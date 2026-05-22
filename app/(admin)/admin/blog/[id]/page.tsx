import AdminBlogEditClient from './AdminBlogEditClient';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminBlogEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !['superadmin', 'owner'].includes(session.user.role)) {
    redirect('/admin/dashboard');
  }

  const { id } = await params;
  return <AdminBlogEditClient postId={id} />;
}