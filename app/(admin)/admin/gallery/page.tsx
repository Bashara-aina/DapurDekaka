import { requireRole } from '@/lib/auth/check-role';
import GalleryClient from './GalleryClient';

export default async function GalleryAdminPage() {
  await requireRole(['superadmin', 'owner']);
  return <GalleryClient />;
}
