import { requireAdmin } from '@/lib/auth/require-admin';
import UsersClient from './UsersClient';

export default async function UsersPage() {
  await requireAdmin(['superadmin', 'owner']);
  return <UsersClient />;
}