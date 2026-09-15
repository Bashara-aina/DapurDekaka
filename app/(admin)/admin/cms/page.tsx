import { requireRole } from '@/lib/auth/check-role';
import CmsListClient from './CmsListClient';

export default async function CmsPagesPage() {
  await requireRole(['superadmin', 'owner']);
  return <CmsListClient />;
}
