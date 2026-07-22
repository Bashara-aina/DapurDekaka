import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { userRoleEnum } from '@/lib/db/schema';
import { logger } from '@/lib/utils/logger';

type UserRole = (typeof userRoleEnum.enumValues)[number];

export async function requireRole(allowedRoles: UserRole[]) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const userData = session.user as { isActive?: boolean };
  if (userData.isActive === false) {
    redirect('/login?inactive=1');
  }

  const userRole = session.user.role as UserRole;

  if (!allowedRoles.includes(userRole)) {
    logger.warn('[check-role] Access forbidden', { userId: session?.user?.id, role: userRole, allowedRoles });
    redirect('/');
  }

  return session;
}

export async function requireGuest() {
  const session = await auth();
  if (session?.user) {
    redirect('/');
  }
  return null;
}
