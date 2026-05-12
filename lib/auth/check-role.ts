import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { userRoleEnum } from '@/lib/db/schema';

type UserRole = (typeof userRoleEnum.enumValues)[number];

export async function requireRole(allowedRoles: UserRole[]) {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/login');
  }

  const userRole = session.user.role;

  if (!allowedRoles.includes(userRole)) {
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
