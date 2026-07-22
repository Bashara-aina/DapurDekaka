import { AdminSidebar } from '@/components/admin/layout/AdminSidebar';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');
  const userData = session.user as { role?: string; isActive?: boolean };
  if (userData.isActive === false) redirect('/login?inactive=1');
  if (!['superadmin', 'owner', 'warehouse'].includes(userData.role ?? '')) {
    redirect('/');
  }
  const role = userData.role ?? '';

  return (
    <div className="min-h-screen bg-admin-content flex">
      <AdminSidebar role={role} variant="desktop" />

      {/* Main content — offset by sidebar width on desktop */}
      <div className="flex-1 flex flex-col lg:pl-60">
        <AdminHeader role={role} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
