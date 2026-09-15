import { requireRole } from '@/lib/auth/check-role';
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { like, asc } from 'drizzle-orm';
import { FLAGS } from '@/lib/config/feature-flags';
import FeatureFlagsClient from './FeatureFlagsClient';

export const dynamic = 'force-dynamic';

export default async function FeatureFlagsPage() {
  await requireRole(['superadmin']);

  const stored = await db
    .select()
    .from(systemSettings)
    .where(like(systemSettings.key, 'feature_flag_%'))
    .orderBy(asc(systemSettings.key));

  return <FeatureFlagsClient flags={FLAGS} stored={stored} />;
}