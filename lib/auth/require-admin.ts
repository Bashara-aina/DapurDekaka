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
import type { NextResponse } from 'next/server';
import type { Session } from 'next-auth';

type AdminRole = 'owner' | 'superadmin' | 'warehouse';

const DEFAULT_ADMIN_ROLES: AdminRole[] = ['owner', 'superadmin'];
const VIEWER_ROLES: AdminRole[] = ['owner', 'superadmin', 'warehouse'];

type SessionUser = NonNullable<Session>['user'];

/**
 * Verify the user has an active session and one of the allowed admin roles.
 *
 * @param roles  Array of allowed roles. Defaults to ['owner', 'superadmin']
 * @returns      The session user if authorized, or a NextResponse (401/403) if not
 */
export async function requireAdmin(
  roles: AdminRole[] = DEFAULT_ADMIN_ROLES
): Promise<{ user: SessionUser } | NextResponse> {
  const session = await auth();

  if (!session?.user) {
    return unauthorized();
  }

  const userData = session.user as { role?: string; isActive?: boolean };

  // Deactivated users are not allowed to call admin APIs
  if (userData.isActive === false) {
    return unauthorized('Akun Anda telah dinonaktifkan');
  }

  const userRole = userData.role as AdminRole;

  if (!roles.includes(userRole)) {
    return forbidden('Anda tidak memiliki akses ke fitur ini');
  }

  return { user: session.user };
}

/**
 * Require superadmin only role.
 * Shorthand for requireAdmin(['superadmin'])
 */
export async function requireSuperadmin(): Promise<{ user: SessionUser } | NextResponse> {
  return requireAdmin(['superadmin']);
}

/**
 * Require any admin or warehouse role.
 * Shorthand for requireAdmin(['owner', 'superadmin', 'warehouse'])
 */
export async function requireAnyAdmin(): Promise<{ user: SessionUser } | NextResponse> {
  return requireAdmin(VIEWER_ROLES);
}