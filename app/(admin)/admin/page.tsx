import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

/**
 * Role-aware admin landing. Dashboard is superadmin-only; warehouse/owner
 * must not be sent there or requireRole() bounces them to `/`.
 */
export default async function AdminPage() {
  const session = await auth();
  const role = session?.user?.role;

  if (role === 'warehouse') {
    redirect('/admin/field');
  }
  if (role === 'owner') {
    redirect('/admin/orders');
  }
  redirect('/admin/dashboard');
}
