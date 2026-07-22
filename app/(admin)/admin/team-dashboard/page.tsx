import { requireRole } from '@/lib/auth/check-role';
import TeamDashboardClient from './TeamDashboardClient';

export default async function TeamDashboardPage() {
  await requireRole(['superadmin']);
  return <TeamDashboardClient />;
}