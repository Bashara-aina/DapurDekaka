import { requireAdmin } from '@/lib/auth/require-admin';
import NewB2BQuoteClient from './NewB2BQuoteClient';

export default async function NewB2BQuotePage() {
  await requireAdmin(['superadmin', 'owner']);
  return <NewB2BQuoteClient />;
}