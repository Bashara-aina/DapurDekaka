import { requireRole } from '@/lib/auth/check-role';
import TestimonialsClient from './TestimonialsClient';

export default async function TestimonialsPage() {
  await requireRole(['superadmin', 'owner']);
  return <TestimonialsClient />;
}