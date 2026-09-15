import { requireRole } from '@/lib/auth/check-role';
import B2bProfilesClient from './B2bProfilesClient';

export default async function B2bProfilesPage() {
  await requireRole(['superadmin', 'owner']);
  return <B2bProfilesClient />;
}
