import { NextResponse } from 'next/server';
import { success, serverError, forbidden } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { checkExpiringPoints } from '@/lib/points/expiry-check';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
    }

    if (session.user.role !== 'superadmin' && session.user.role !== 'owner') {
      return forbidden('Anda tidak memiliki akses');
    }

    const result = await checkExpiringPoints();

    return success({
      processed: result.processed,
      errorsCount: result.errors.length,
      errors: result.errors.slice(0, 10),
    });
  } catch (error) {
    console.error('[admin/points/expiry-reminders]', error);
    return serverError(error);
  }
}