import { requireRole } from '@/lib/auth/check-role';
import { CouponNewClient } from './CouponNew';

export default async function AdminCouponNewPage() {
  await requireRole(['superadmin']);
  return <CouponNewClient />;
}