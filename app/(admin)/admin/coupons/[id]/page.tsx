import { requireRole } from '@/lib/auth/check-role';
import CouponEditClient from './CouponEditClient';

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminCouponEditPage({ params }: PageProps) {
  await requireRole(['superadmin']);
  const { id } = await params;
  return <CouponEditClient couponId={id} />;
}