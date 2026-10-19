import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { auth } from '@/lib/auth';
import { isFlagEnabled, type FlagName } from '@/lib/config/feature-flags';
import { isMaintenanceMode } from '@/lib/ops/maintenance';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

// NOTE: SAMEORIGIN (not DENY) to match next.config.mjs — Midtrans Snap
// renders inside an iframe/overlay on checkout and DENY would break it.
function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return res;
}

function redirectWithHeaders(req: NextRequest, to: string): NextResponse {
  return withSecurityHeaders(NextResponse.redirect(new URL(to, req.url)));
}

// Feature kill-list guards (L4) — table-driven so adding a gate is one row.
const FLAG_GUARDS: ReadonlyArray<{ prefix: string; flag: FlagName }> = [
  { prefix: '/admin/blog', flag: 'blogCMS' },
  { prefix: '/admin/ai-content', flag: 'aiContent' },
  { prefix: '/admin/b2b-inquiries', flag: 'b2bPortal' },
  { prefix: '/admin/b2b-quotes', flag: 'b2bPortal' },
];

const WAREHOUSE_PATHS = ['/admin/inventory', '/admin/shipments', '/admin/field', '/admin/orders'];

// Storefront paths subject to the maintenance circuit breaker. NOTE: the
// matcher below excludes /api/*, so middleware never runs for API routes —
// no api-path carve-outs needed here.
function isStorefrontPath(pathname: string): boolean {
  return (
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/products') ||
    pathname === '/' ||
    pathname.startsWith('/blog')
  );
}

export default async function middleware(req: NextRequest) {
  // Step 1: Run next-intl locale detection (handles redirect if locale prefix needed)
  const intlResponse = intlMiddleware(req);

  // If intl middleware issued a redirect (e.g. to add locale prefix), return it
  // WITH security headers (previously returned bare).
  if (intlResponse.status === 307 || intlResponse.status === 308) {
    return withSecurityHeaders(intlResponse);
  }
  const response = intlResponse;

  // Step 2: Run auth on the same request (intl already processed locale)
  const { pathname } = req.nextUrl;
  const session = await auth() as { user?: { isActive?: boolean; role?: string; id?: string } } | null;

  // Inactive user check
  if (session?.user?.isActive === false) {
    const redirectUrl = pathname.startsWith('/admin')
      ? '/login?inactive=1'
      : `/login?inactive=1&callbackUrl=${encodeURIComponent(pathname)}`;
    return redirectWithHeaders(req, redirectUrl);
  }

  // Admin role guard
  if (pathname.startsWith('/admin')) {
    if (!session?.user) {
      return redirectWithHeaders(req, '/login');
    }
    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return redirectWithHeaders(req, '/');
    }
    if (role === 'warehouse' && !WAREHOUSE_PATHS.some((p) => pathname.startsWith(p))) {
      return redirectWithHeaders(req, '/admin/inventory');
    }
  }

  // Feature kill-list guards (L4) — check if the route should be hidden
  for (const { prefix, flag } of FLAG_GUARDS) {
    if (pathname.startsWith(prefix) && !isFlagEnabled(flag)) {
      return redirectWithHeaders(req, '/admin');
    }
  }

  // Maintenance mode guard (L4 circuit breaker) — block storefront when active.
  // Checks BOTH the env var (fast path, set at deploy time) AND the DB setting
  // (5-min cache, togglable from admin panel).
  // PERF: prefilter storefront paths BEFORE the (cached) DB read so admin and
  // account traffic never pays for the lookup.
  // EDGE-SAFETY: middleware runs on the Edge runtime where the WS-backed Pool
  // can fail; on DB error fall back to the env fast-path (fail-open = keep
  // serving) rather than 500ing every storefront request.
  if (isStorefrontPath(pathname) && !pathname.startsWith('/maintenance')) {
    let maintenance = process.env.MAINTENANCE_MODE === 'true';
    try {
      if (!maintenance) maintenance = await isMaintenanceMode();
    } catch {
      maintenance = process.env.MAINTENANCE_MODE === 'true';
    }
    if (maintenance) {
      return redirectWithHeaders(req, '/maintenance');
    }
  }

  // Account guard
  if (pathname.startsWith('/account')) {
    if (!session?.user) {
      return redirectWithHeaders(req, `/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }

  // B2B account guard
  if (pathname.startsWith('/b2b/account')) {
    if (!session?.user) {
      return redirectWithHeaders(req, `/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
    if (session.user.role !== 'b2b' && session.user.role !== 'superadmin') {
      return redirectWithHeaders(req, '/b2b');
    }
  }

  // Add security headers (preserve any headers set by intlMiddleware)
  return withSecurityHeaders(response);
}

export const config = {
  // Match all pathnames except for paths that start with:
  // - api (API routes)
  // - _next/static (static files)
  // - _next/image (image optimization)
  // - favicon.ico, robots.txt, sitemap etc (files with dots)
  matcher: ['/((?!api|_next/static|_next/image|_vercel|favicon|robots|sitemap|.*\\..*).*)'],
};