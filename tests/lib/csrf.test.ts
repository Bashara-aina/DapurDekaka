import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import {
  issueCsrfToken,
  serializeCsrfCookie,
  verifyCsrfToken,
  isCsrfExempt,
  withCsrf,
  CSRF_HEADER_NAME,
} from '@/lib/utils/csrf';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-that-is-at-least-32-chars-long!';
});

function postReq(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method: 'POST', headers });
}

describe('csrf (double-submit, next-csrf pattern)', () => {
  it('issued tokens verify', () => {
    expect(verifyCsrfToken(issueCsrfToken())).toBe(true);
  });

  it('rejects malformed / empty tokens', () => {
    expect(verifyCsrfToken(null)).toBe(false);
    expect(verifyCsrfToken(undefined)).toBe(false);
    expect(verifyCsrfToken('')).toBe(false);
    expect(verifyCsrfToken('a.b')).toBe(false);
    expect(verifyCsrfToken('a.b.c.d')).toBe(false);
  });

  it('rejects tampered tokens', () => {
    const token = issueCsrfToken();
    const [ts, nonce, sig] = token.split('.');
    if (!ts || !nonce || !sig) throw new Error('malformed test token');
    const flipped = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
    expect(verifyCsrfToken(`${ts}.${nonce}.${flipped}`)).toBe(false);
  });

  it('serializes a readable SameSite=Lax cookie', () => {
    const cookie = serializeCsrfCookie('tok');
    expect(cookie).toContain('ddk_csrf=tok');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('HttpOnly');
  });

  it('exempts safe methods and webhook/cron/callback paths', () => {
    expect(
      isCsrfExempt(new NextRequest('http://localhost/api/auth/2fa/verify', { method: 'GET' }))
    ).toBe(true);
    expect(isCsrfExempt(postReq('/api/webhooks/midtrans'))).toBe(true);
    expect(isCsrfExempt(postReq('/api/cron/anything'))).toBe(true);
    expect(isCsrfExempt(postReq('/api/auth/callback/credentials'))).toBe(true);
    expect(isCsrfExempt(postReq('/api/auth/2fa/verify'))).toBe(false);
  });

  it('withCsrf: 403 without token, 200 with valid header', async () => {
    const ok = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });
    const handler = withCsrf(ok);

    const denied = await handler(postReq('/api/auth/2fa/verify'));
    expect(denied.status).toBe(403);
    expect(((await denied.json()) as { code: string }).code).toBe('CSRF_VERIFICATION_FAILED');

    const allowed = await handler(
      postReq('/api/auth/2fa/verify', { [CSRF_HEADER_NAME]: issueCsrfToken() })
    );
    expect(allowed.status).toBe(200);
  });
});