import { auth } from '@/lib/auth';
import { isFlagEnabled, type FlagName } from '@/lib/config/feature-flags';
import { isMaintenanceModeEnv } from '@/lib/ops/maintenance';
import { isSameOriginRequest } from '@/lib/utils/same-origin';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
  { prefix: '/admin/b2b-profiles', flag: 'b2bPortal' },
  // Portal account UI — landing `/b2b` stays public for WA inquiry.
  { prefix: '/b2b/account', flag: 'b2bPortal' },
];

const WAREHOUSE_PATHS = ['/admin/inventory', '/admin/shipments', '/admin/field', '/admin/orders'];

// Storefront paths subject to the maintenance circuit breaker.
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
  const { pathname } = req.nextUrl;

  // API routes: no locale rewrite / page auth here. Handlers enforce their own
  // auth and signatures. S6 origin check applies to mutating admin APIs only —
  // never webhooks/cron (originless Midtrans, Biteship, Vercel Cron).
  if (pathname.startsWith('/api/')) {
    if (pathname.startsWith('/api/admin/')) {
      const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
      if (isMutation && !isSameOriginRequest(req)) {
        return withSecurityHeaders(
          NextResponse.json(
            { success: false, error: 'Cross-origin request rejected', code: 'FORBIDDEN' },
            { status: 403 }
          )
        );
      }
    }
    // B2B portal APIs stay off when the portal flag is off. Public inquiry remains.
    const isB2bPortalApi =
      pathname.startsWith('/api/b2b/') && !pathname.startsWith('/api/b2b/inquiry');
    if (isB2bPortalApi && !isFlagEnabled('b2bPortal')) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Fitur B2B portal belum tersedia', code: 'FORBIDDEN' },
          { status: 403 }
        )
      );
    }
    return withSecurityHeaders(NextResponse.next());
  }

  // Locale is cookie-based (NEXT_LOCALE, read in i18n/request.ts) and the app
  // has no [locale] route segment. next-intl's routing middleware would
  // rewrite `/` → `/id`, which matches no route and 404s every page — so it
  // must NOT run here.
  // Forward pathname so Node layouts can skip DB maintenance redirect on
  // /maintenance without opening Neon from Edge.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  const session = await auth() as {
    user?: {
      isActive?: boolean;
      role?: string;
      id?: string;
      requiresTwoFactorSetup?: boolean;
    };
  } | null;

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
    // Force 2FA enrollment before any admin surface.
    if (session.user.requiresTwoFactorSetup) {
      return redirectWithHeaders(req, '/account/profile?setup2fa=1');
    }
    if (role === 'warehouse' && !WAREHOUSE_PATHS.some((p) => pathname.startsWith(p))) {
      return redirectWithHeaders(req, '/admin/inventory');
    }
  }

  // Feature kill-list guards (L4) — check if the route should be hidden
  for (const { prefix, flag } of FLAG_GUARDS) {
    if (pathname.startsWith(prefix) && !isFlagEnabled(flag)) {
      const fallback = prefix.startsWith('/b2b') ? '/b2b' : '/admin';
      return redirectWithHeaders(req, fallback);
    }
  }

  // Maintenance emergency kill-switch — env only on Edge (no Neon wake).
  // Admin DB toggle is enforced in app/(store)/layout.tsx (Node runtime).
  if (
    isStorefrontPath(pathname) &&
    !pathname.startsWith('/maintenance') &&
    isMaintenanceModeEnv()
  ) {
    return redirectWithHeaders(req, '/maintenance');
  }

  // Account guard
  if (pathname.startsWith('/account')) {
    if (!session?.user) {
      return redirectWithHeaders(req, `/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }

  // B2B account guard (FLAG_GUARDS already redirects when portal flag is off)
  if (pathname.startsWith('/b2b/account') && isFlagEnabled('b2bPortal')) {
    if (!session?.user) {
      return redirectWithHeaders(req, `/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
    if (session.user.role !== 'b2b' && session.user.role !== 'superadmin') {
      return redirectWithHeaders(req, '/b2b');
    }
  }

  // Add security headers
  return withSecurityHeaders(response);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_vercel|favicon|robots|sitemap|.*\\..*).*)',
    '/api/:path*',
  ],
};
