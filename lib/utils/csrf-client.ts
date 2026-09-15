'use client';

/**
 * Client helper for CSRF-protected requests (pairs with lib/utils/csrf.ts).
 *
 * Flow: fetch `/api/csrf-token` once (sets the readable `ddk_csrf` cookie),
 * then echo the token in the `x-csrf-token` header on every state-changing
 * request. `fetchWithCsrf` does both transparently.
 */

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf-constants';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

async function ensureToken(): Promise<string | null> {
  const existing = readCookie(CSRF_COOKIE_NAME);
  if (existing) return existing;
  try {
    const res = await fetch('/api/csrf-token', { method: 'GET', credentials: 'same-origin' });
    if (!res.ok) return null;
    const json = await res.json();
    const token = json?.data?.token as string | undefined;
    return token ?? readCookie(CSRF_COOKIE_NAME);
  } catch {
    return null;
  }
}

export async function fetchWithCsrf(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await ensureToken();
  const headers = new Headers(init.headers ?? {});
  if (token) headers.set(CSRF_HEADER_NAME, token);
  return fetch(input, { ...init, headers, credentials: 'same-origin' });
}