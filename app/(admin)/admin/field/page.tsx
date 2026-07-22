import { requireRole } from '@/lib/auth/check-role';
import FieldDashboardClient from './FieldDashboardClient';

export default async function FieldDashboardPage() {
  await requireRole(['superadmin', 'owner', 'warehouse']);
  return <FieldDashboardClient />;
}