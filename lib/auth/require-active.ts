import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function requireActiveUser(): Promise<{ userId: string; role: string } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = session.user as { id?: string; role?: string; isActive?: boolean };
  if (user.isActive === false) return null;
  return { userId: user.id!, role: user.role ?? 'customer' };
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json(
    { success: false, error: message, code: 'UNAUTHORIZED' },
    { status: 401 }
  );
}
