import { requireAdmin } from '@/lib/auth/require-admin';
import TestimonialsClient from './TestimonialsClient';

export default async function TestimonialsPage() {
  await requireAdmin(['superadmin', 'owner']);
  return <TestimonialsClient />;
}