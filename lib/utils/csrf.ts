import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import {
  CSRF_COOKIE_NAME as COOKIE_NAME,
  CSRF_HEADER_NAME as HEADER_NAME,
  CSRF_MAX_AGE_SEC as MAX_AGE_SEC,
} from './csrf-constants';

/**
 * CSRF protection — double-submit cookie pattern.
 *
 * Design follows `shahradelahi/next-csrf` (MIT): a signed token is stored in a
 * readable cookie and echoed back in a header on state-changing requests.
 * Verification is stateless (HMAC over timestamp + nonce), so no server-side
 * session store is needed.
 *
 * Flow: GET /api/csrf-token (issues token + sets cookie) → client echoes the
 * token in the `x-csrf-token` header via `fetchWithCsrf` (csrf-client.ts) →
 * `withCsrf(handler)` verifies on POST/PUT/PATCH/DELETE.
 */

export { CSRF_HEADER_NAME } from './csrf-constants';

function getSecret(): string {
  // Read lazily (per call) so test harnesses can set AUTH_SECRET in beforeAll.
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET must be set to issue CSRF tokens');
  }
  return secret;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/**
 * Issue a `ts.nonce.sig` token. Timestamp is base36 ms epoch (no dots);
 * nonce is 128-bit hex (no dots); sig is hex HMAC-SHA256 over `ts.nonce`.
 */
export function issueCsrfToken(): string {
  const ts = Date.now().toString(36);
  const nonce = crypto.randomBytes(16).toString('hex');
  const sig = sign(`${ts}.${nonce}`, getSecret());
  return `${ts}.${nonce}.${sig}`;
}

/** Stateless HMAC verification. Fail-closed on any malformed input. */
export function verifyCsrfToken(token: unknown): boolean {
  if (typeof token !== 'string' || token.length === 0) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [ts, nonce, sig] = parts;
  if (!ts || !nonce || !sig) return false;
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return false;
  }
  const expected = sign(`${ts}.${nonce}`, secret);
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  if (!/^[0-9a-f]+$/.test(sig)) return false;
  if (!/^[0-9a-z]+$/.test(ts) || !/^[0-9a-f]+$/.test(nonce)) return false;
  try {
    if (!crypto.timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  // Freshness bound: token timestamp must be within the cookie lifetime
  // (plus 5 min future skew tolerance). Malformed timestamps fail closed.
  const issuedAt = Number.parseInt(ts, 36);
  if (!Number.isFinite(issuedAt)) return false;
  const ageMs = Date.now() - issuedAt;
  if (ageMs > MAX_AGE_SEC * 1000 || ageMs < -5 * 60 * 1000) return false;
  return true;
}

/**
 * Serialize the readable double-submit cookie. Deliberately NOT HttpOnly —
 * client JS must read it to echo the header. SameSite=Lax blocks cross-site
 * POST cookie sends as the first line of defense.
 */
export function serializeCsrfCookie(token: string): string {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${MAX_AGE_SEC}`,
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Challenged never: signature-verified webhooks, CRON_SECRET-gated crons,
// and NextAuth's own OAuth callback handshake (NextAuth signs `state` itself).
const EXEMPT_PREFIXES = ['/api/webhooks/', '/api/cron/', '/api/auth/callback/'];

/** True when the request skips CSRF challenge (safe method or exempt path). */
export function isCsrfExempt(req: NextRequest): boolean {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return true;
  let pathname = '';
  try {
    pathname = req.nextUrl.pathname;
  } catch {
    return false;
  }
  return EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
}

function csrfDenied(): Response {
  return Response.json(
    { success: false, error: 'CSRF verification failed', code: 'CSRF_VERIFICATION_FAILED' },
    { status: 403 }
  );
}

/**
 * Wrap a mutating handler with the double-submit challenge.
 * Exempt requests pass through untouched; others must present a valid
 * `x-csrf-token` header or receive 403 CSRF_VERIFICATION_FAILED.
 */
export function withCsrf<T = unknown>(
  handler: (req: NextRequest, context?: T) => Promise<Response>
) {
  return async (req: NextRequest, context?: T): Promise<Response> => {
    if (isCsrfExempt(req)) return handler(req, context);
    if (!verifyCsrfToken(req.headers.get(HEADER_NAME))) return csrfDenied();
    return handler(req, context);
  };
}

/**
 * Origin / Referer check — lightweight CSRF gate for browser-fetch routes.
 *
 * A cross-site attacker cannot spoof the `Origin` header (browsers set it on
 * POST/fetch and forbid JS from overriding it), so rejecting requests whose
 * Origin/Referer host differs from the app host blocks classic CSRF.
 *
 * Requests with NEITHER header (curl, tests, server-to-server, same-origin
 * navigations) are allowed through — cookie-authenticated browser fetches
 * always send `Origin` on POST, so the check still bites where it matters
 * without breaking API clients. Pair with `withCsrf` (double-submit token)
 * on high-value routes for defence in depth.
 *
 * Usage (wired in account/checkout/coupon/shipping routes):
 *
 *   if (!isSameOriginRequest(req)) return csrfRejected();
 */
export function isSameOriginRequest(req: NextRequest | Request): boolean {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  if (!origin && !referer) return true;
  try {
    const host = new URL(req.url).host;
    if (origin && new URL(origin).host === host) return true;
    if (referer && new URL(referer).host === host) return true;
    return false;
  } catch {
    return false;
  }
}

/** Standard 403 JSON response for failed CSRF checks. */
export function csrfRejected(): Response {
  return csrfDenied();
}
