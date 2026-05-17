import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const middleware = auth(async (req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (pathname.startsWith('/admin')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    if (role === 'warehouse') {
      const allowed = ['/admin/inventory', '/admin/shipments', '/admin/field'];
      if (!allowed.some((p) => pathname.startsWith(p))) {
        return NextResponse.redirect(new URL('/admin/field', req.url));
      }
    }
  }

  if (pathname.startsWith('/account')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url));
    }
  }

  if (pathname.startsWith('/b2b/account')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url));
    }
    if (session.user.role !== 'b2b' && session.user.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/b2b', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/b2b/account/:path*'],
};