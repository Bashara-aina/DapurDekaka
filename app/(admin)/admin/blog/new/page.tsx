import AdminBlogNewClient from './AdminBlogNewClient';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminBlogNewPage() {
  const session = await auth();
  if (!session?.user || !['superadmin', 'owner'].includes(session.user.role)) {
    redirect('/admin/dashboard');
  }

  return <AdminBlogNewClient />;
}