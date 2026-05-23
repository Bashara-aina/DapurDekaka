import { requireRole } from '@/lib/auth/check-role';
import CustomersClient from './CustomersClient';

export default async function CustomersPage() {
  await requireRole(['superadmin', 'owner']);
  return <CustomersClient />;
}