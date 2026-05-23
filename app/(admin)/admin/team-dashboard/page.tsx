import { requireAdmin } from '@/lib/auth/require-admin';
import TeamDashboardClient from './TeamDashboardClient';

export default async function TeamDashboardPage() {
  await requireAdmin(['superadmin']);
  return <TeamDashboardClient />;
}