import { requireRole } from '@/lib/auth/check-role';
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { SettingsClient } from './SettingsClient';

export default async function SettingsPage() {
  const session = await requireRole(['superadmin']);
  const userRole = session.user.role;

  const settings = await db.query.systemSettings.findMany({
    orderBy: [asc(systemSettings.key)],
  });

  const settingsWithType = settings.map((s) => ({
    id: s.id,
    key: s.key,
    value: s.value,
    description: s.description,
    type: s.type as 'string' | 'number' | 'boolean',
    updatedAt: s.updatedAt?.toISOString() ?? null,
  }));

  return <SettingsClient initialSettings={settingsWithType} initialRole={userRole} />;
}