import { requireRole } from '@/lib/auth/check-role';
import UsersClient from './UsersClient';

export default async function UsersPage() {
  await requireRole(['superadmin', 'owner']);
  return <UsersClient />;
}