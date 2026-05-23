import { requireRole } from '@/lib/auth/check-role';
import { CarouselNewClient } from './CarouselNewClient';

export default async function AdminCarouselNewPage() {
  await requireRole(['superadmin', 'owner']);
  return <CarouselNewClient />;
}