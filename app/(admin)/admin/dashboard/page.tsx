import { requireRole } from '@/lib/auth/check-role';
import SuperadminDashboardClient from './SuperadminDashboardClient';

export default async function DashboardPage() {
  await requireRole(['superadmin']);
  return <SuperadminDashboardClient />;
}