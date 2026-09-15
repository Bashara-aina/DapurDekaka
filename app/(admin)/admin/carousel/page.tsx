import { db } from '@/lib/db';
import { carouselSlides } from '@/lib/db/schema';
import { isNull, asc } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/check-role';
import CarouselGridClient from './CarouselGridClient';

export const dynamic = 'force-dynamic';

export default async function AdminCarouselPage() {
  await requireRole(['superadmin', 'owner']);
  const allSlides = await db.query.carouselSlides.findMany({
    where: isNull(carouselSlides.deletedAt),
    orderBy: [asc(carouselSlides.sortOrder)],
  });

  return <CarouselGridClient slides={allSlides} />;
}