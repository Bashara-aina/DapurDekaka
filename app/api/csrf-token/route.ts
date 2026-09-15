import { NextResponse } from 'next/server';
import { issueCsrfToken, serializeCsrfCookie } from '@/lib/utils/csrf';
import { success, serverError } from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/csrf-token — issue a double-submit CSRF token.
 *
 * Sets the readable `ddk_csrf` cookie AND returns the token in the body
 * (for clients that prefer explicit handling). Safe method → never challenged.
 */
export async function GET(): Promise<Response> {
  try {
    const token = issueCsrfToken();
    const res = NextResponse.json(success({ token }));
    res.headers.append('Set-Cookie', serializeCsrfCookie(token));
    return res;
  } catch (error) {
    return serverError(error);
  }
}