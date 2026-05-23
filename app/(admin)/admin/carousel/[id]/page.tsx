import { requireRole } from '@/lib/auth/check-role';
import { CarouselEditClient } from './CarouselEditClient';

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminCarouselEditPage({ params }: PageProps) {
  await requireRole(['superadmin', 'owner']);
  return <CarouselEditClient params={params} />;
}