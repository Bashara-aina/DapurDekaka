import { authMiddleware } from '@/lib/auth';
import { NextResponse } from 'next/server';

const handleAuth = authMiddleware(async ({ auth, nextUrl }) => {
  const { pathname } = nextUrl;
  const session = auth;
  const base = nextUrl.href;

  if (pathname.startsWith('/admin')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', base));
    }
    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return NextResponse.redirect(new URL('/', base));
    }
    if (role === 'warehouse') {
      const allowed = ['/admin/inventory', '/admin/shipments', '/admin/field', '/admin/orders'];
      if (!allowed.some((p) => pathname.startsWith(p))) {
        return NextResponse.redirect(new URL('/admin/field', base));
      }
    }
  }

  if (pathname.startsWith('/account')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, base));
    }
  }

  if (pathname.startsWith('/b2b/account')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, base));
    }
    if (session.user.role !== 'b2b' && session.user.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/b2b', base));
    }
  }

  return NextResponse.next();
});

export default handleAuth;

export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/b2b/account/:path*'],
};