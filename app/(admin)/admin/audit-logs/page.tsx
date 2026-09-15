import { requireRole } from '@/lib/auth/check-role';
import { db } from '@/lib/db';
import { adminActivityLogs } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import AuditLogsClient from './AuditLogsClient';

export default async function AuditLogsPage() {
  await requireRole(['superadmin']);

  const initialLogs = await db.query.adminActivityLogs.findMany({
    with: { user: true },
    orderBy: desc(adminActivityLogs.createdAt),
    limit: 100,
  });

  return <AuditLogsClient initialLogs={initialLogs} />;
}