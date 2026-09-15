import type { NextRequest } from 'next/server';

/**
 * Extract the best-effort client IP from a NextRequest.
 * Prefers `x-forwarded-for` (first hop) and falls back to `x-real-ip`.
 * Trims whitespace and takes the first IP in the chain.
 */
export function getClientIp(req: NextRequest | Request): string | null {
  const headers = req.headers;
  const fwd = headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = headers.get('x-real-ip');
  if (real) return real.trim();
  return null;
}

/**
 * Extract the User-Agent header (truncated to a safe length).
 */
export function getUserAgent(req: NextRequest | Request, maxLength = 500): string | null {
  const ua = req.headers.get('user-agent');
  if (!ua) return null;
  return ua.length > maxLength ? ua.slice(0, maxLength) : ua;
}