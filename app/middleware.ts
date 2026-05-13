import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from '@auth/core/jwt';

const AUTH_SECRET = process.env.AUTH_SECRET!;

async function getSessionFromRequest(req: NextRequest): Promise<{
  id?: string;
  role?: string;
} | null> {
  const token = await getToken({
    req,
    secret: AUTH_SECRET,
    cookieName: 'authjs.session-token',
  });

  if (!token?.sub) return null;

  return {
    id: token.sub,
    role: (token.role as string) || 'customer',
  };
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await getSessionFromRequest(req);

  if (pathname.startsWith('/admin')) {
    if (!session?.id) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    const role = session.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    if (role === 'warehouse') {
      const allowed = ['/admin/inventory', '/admin/shipments'];
      if (!allowed.some((p) => pathname.startsWith(p))) {
        return NextResponse.redirect(new URL('/admin/inventory', req.url));
      }
    }
  }

  if (pathname.startsWith('/account')) {
    if (!session?.id) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  if (pathname.startsWith('/b2b/account')) {
    if (!session?.id) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    if (session.role !== 'b2b' && session.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/b2b', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/b2b/account/:path*'],
};
