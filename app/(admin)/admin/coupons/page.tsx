import { db } from '@/lib/db';
import { coupons } from '@/lib/db/schema';
import { desc, isNull } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/check-role';
import CouponsTableClient from './CouponsTableClient';

export const dynamic = 'force-dynamic';

export default async function AdminCouponsPage() {
  await requireRole(['superadmin']);
  const allCoupons = await db.query.coupons.findMany({
    where: isNull(coupons.deletedAt),
    orderBy: [desc(coupons.createdAt)],
  });

  return <CouponsTableClient coupons={allCoupons} />;
}