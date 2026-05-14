import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { success, unauthorized, forbidden } from '@/lib/utils/api-response';
import { generateSignedUploadParams } from '@/lib/services/cloudinary.service';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorized();
  if (!['superadmin', 'owner'].includes(session.user.role ?? '')) return forbidden();

  const folder = req.nextUrl.searchParams.get('folder') ?? 'products';
  const params = await generateSignedUploadParams(`dapurdekaka/${folder}`);
  return success(params);
}