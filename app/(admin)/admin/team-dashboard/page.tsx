import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function TeamDashboardPage() {
  const session = await auth();
  if (!session?.user || !['superadmin', 'owner'].includes(session.user.role)) {
    redirect('/admin/dashboard');
  }

  redirect('/admin/dashboard');
}