import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { unauthorized, forbidden } from '@/lib/utils/api-response';

/**
 * Shared guard for the 2FA routes (NOT a route handler — underscore file).
 * Returns the session + fresh user row, or an error Response to return.
 */
export async function requireTwoFactorUser(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: unauthorized('Silakan login terlebih dahulu') as Response };
  }
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  if (!user || user.isActive === false) {
    return { error: forbidden('Akun tidak aktif') as Response };
  }
  return { session, user };
}

const ADMIN_ROLES = new Set(['superadmin', 'owner', 'warehouse', 'b2b']);

export function isAdminRole(role: string | undefined | null): boolean {
  return !!role && ADMIN_ROLES.has(role);
}
