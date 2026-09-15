import { requireRole } from '@/lib/auth/check-role';
import CmsEditClient from './CmsEditClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CmsEditPage({ params }: PageProps) {
  await requireRole(['superadmin', 'owner']);
  const { slug } = await params;
  return <CmsEditClient slug={slug} />;
}
