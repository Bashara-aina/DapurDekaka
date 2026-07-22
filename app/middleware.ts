import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { auth } from '@/lib/auth';
import { isFlagEnabled } from '@/lib/config/feature-flags';
import { isMaintenanceModeEnv } from '@/lib/ops/maintenance';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  // Step 1: Run next-intl locale detection (handles redirect if locale prefix needed)
  let response = intlMiddleware(req);

  // If intl middleware issued a redirect (e.g. to add locale prefix), return it
  if (response.status === 307 || response.status === 308) {
    return response;
  }

  // Step 2: Run auth on the same request (intl already processed locale)
  const { pathname } = req.nextUrl;
  const session = await auth() as { user?: { isActive?: boolean; role?: string; id?: string } } | null;

  // Inactive user check
  if (session?.user?.isActive === false) {
    const redirectUrl = pathname.startsWith('/admin')
      ? '/login?inactive=1'
      : `/login?inactive=1&callbackUrl=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(new URL(redirectUrl, req.url));
  }

  // Admin role guard
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
        return NextResponse.redirect(new URL('/admin/inventory', req.url));
      }
    }
  }

  // Feature kill-list guards (L4) — check if the route should be hidden
  if (pathname.startsWith('/admin/blog') && !isFlagEnabled('blogCMS')) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }
  if (pathname.startsWith('/admin/ai-content') && !isFlagEnabled('aiContent')) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }
  if (pathname.startsWith('/admin/b2b-inquiries') && !isFlagEnabled('b2bPortal')) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }
  if (pathname.startsWith('/admin/b2b-quotes') && !isFlagEnabled('b2bPortal')) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  // Maintenance mode guard (L4 circuit breaker) — block storefront when MAINTENANCE_MODE=true
  // Allows admin and webhooks to keep working during an incident.
  if (isMaintenanceModeEnv() && !pathname.startsWith('/maintenance')) {
    const isAdminPath = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
    const isWebhookPath = pathname.startsWith('/api/webhooks') || pathname.startsWith('/api/cron');
    const isAuthPath = pathname.startsWith('/api/auth');
    if (!isAdminPath && !isWebhookPath && !isAuthPath) {
      if (
        pathname.startsWith('/checkout') ||
        pathname.startsWith('/api/checkout') ||
        pathname.startsWith('/cart') ||
        pathname.startsWith('/api/shipping') ||
        pathname.startsWith('/products') ||
        pathname === '/' ||
        pathname.startsWith('/blog')
      ) {
        return NextResponse.redirect(new URL('/maintenance', req.url));
      }
    }
  }

  // Account guard
  if (pathname.startsWith('/account')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url));
    }
  }

  // B2B account guard
  if (pathname.startsWith('/b2b/account')) {
    if (!session?.user) {
      return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url));
    }
    if (session.user.role !== 'b2b' && session.user.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/b2b', req.url));
    }
  }

  // Add security headers (preserve any headers set by intlMiddleware)
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  // Match all pathnames except for paths that start with:
  // - api (API routes)
  // - _next/static (static files)
  // - _next/image (image optimization)
  // - favicon.ico, robots.txt, sitemap etc (files with dots)
  matcher: ['/((?!api|_next/static|_next/image|_vercel|favicon|robots|sitemap|.*\\..*).*)'],
};