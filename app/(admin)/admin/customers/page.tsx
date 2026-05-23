import { requireAdmin } from '@/lib/auth/require-admin';
import CustomersClient from './CustomersClient';

export default async function CustomersPage() {
  await requireAdmin(['superadmin', 'owner']);
  return <CustomersClient />;
}