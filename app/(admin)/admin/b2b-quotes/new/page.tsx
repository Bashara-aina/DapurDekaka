import { requireRole } from '@/lib/auth/check-role';
import NewB2BQuoteClient from './NewB2BQuoteClient';

export default async function NewB2BQuotePage() {
  await requireRole(['superadmin', 'owner']);
  return <NewB2BQuoteClient />;
}