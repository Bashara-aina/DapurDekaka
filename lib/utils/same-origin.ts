/**
 * Same-origin guard for cookie-authenticated route handlers.
 *
 * Complements (does not replace) the double-submit CSRF module in
 * `./csrf.ts`: SameSite=Lax cookies + an explicit Origin/Referer check give
 * defense-in-depth on money/account mutations, including routes that cannot
 * adopt the token flow yet (JSON fetch clients without the csrf client).
 *
 * Same-origin (or originless requests such as same-origin form posts,
 * curl, and tests) → allow. Verifiably cross-origin → 403.
 */

function requestHost(req: Request): string | null {
  const host = req.headers.get('host');
  if (host) return host.toLowerCase();
  try {
    return new URL(req.url).host.toLowerCase();
  } catch {
    return null;
  }
}

function headerHost(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/** True when the request is verifiably same-origin (or originless). */
export function isSameOriginRequest(req: Request): boolean {
  const origin = headerHost(req.headers.get('origin'));
  const referer = headerHost(req.headers.get('referer'));
  // No verifiable origin (same-origin form posts, curl, tests) → allow.
  if (!origin && !referer) return true;
  const host = requestHost(req);
  if (!host) return false;
  if (origin && origin !== host) return false;
  if (referer && referer !== host) return false;
  return true;
}

/** 403 JSON response for same-origin rejections (matches api-response shape). */
export function sameOriginRejected() {
  return Response.json(
    { success: false, error: 'Cross-origin request rejected', code: 'FORBIDDEN' },
    { status: 403 }
  );
}
