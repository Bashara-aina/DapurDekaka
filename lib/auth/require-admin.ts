/**
 * Role-based authorization guard for admin API routes.
 * Reusable middleware that checks session existence and user role.
 *
 * Usage:
 *   // Require specific roles (default: owner, superadmin)
 *   const session = await requireAdmin();
 *
 *   // Require any of the listed roles
 *   const session = await requireAdmin(['owner', 'superadmin', 'warehouse']);
 *
 *   // Require exact role
 *   const session = await requireAdmin(['superadmin']);
 */

import { auth } from '@/lib/auth';
import { unauthorized, forbidden } from '@/lib/utils/api-response';

type UserRole = 'customer' | 'b2b' | 'warehouse' | 'owner' | 'superadmin';

export type AdminRole = 'superadmin' | 'owner' | 'warehouse';

const DEFAULT_ADMIN_ROLES: AdminRole[] = ['owner', 'superadmin'];
const VIEWER_ROLES: AdminRole[] = ['owner', 'superadmin', 'warehouse'];

/**
 * Verify the user has an active session and one of the allowed admin roles.
 *
 * @param roles  Array of allowed roles. Defaults to ['owner', 'superadmin']
 * @returns      The session object if authorized
 * @response     401 if not authenticated, 403 if role not permitted
 */
export async function requireAdmin<T extends AdminRole = AdminRole>(
  roles: T[] = DEFAULT_ADMIN_ROLES as T[]
): Promise<{ user: { id: string; role: UserRole; email?: string | null; name?: string | null; image?: string | null } }> {
  const session = await auth();

  if (!session?.user) {
    return unauthorized() as never;
  }

  const userRole = session.user.role as string;

  if (!roles.includes(userRole as T)) {
    return forbidden('Anda tidak memiliki akses ke fitur ini') as never;
  }

  return session as { user: { id: string; role: UserRole; email?: string | null; name?: string | null; image?: string | null } };
}

/**
 * Require superadmin only role.
 * Shorthand for requireAdmin(['superadmin'])
 */
export async function requireSuperadmin(): Promise<{ user: { id: string; role: UserRole } }> {
  return requireAdmin(['superadmin']);
}

/**
 * Require any admin or warehouse role.
 * Shorthand for requireAdmin(['owner', 'superadmin', 'warehouse'])
 */
export async function requireAnyAdmin(): Promise<{ user: { id: string; role: UserRole } }> {
  return requireAdmin(VIEWER_ROLES);
}