import { requireAdmin } from '@/lib/auth/require-admin';
import FieldDashboardClient from './FieldDashboardClient';

export default async function FieldDashboardPage() {
  await requireAdmin(['superadmin', 'owner', 'warehouse']);
  return <FieldDashboardClient />;
}