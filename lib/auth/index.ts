import type { Session } from 'next-auth';

import { validateAuthSecret } from '@/lib/config/validate-env';

const IS_BUILD =
  typeof process.env.NEXT_PHASE !== 'undefined' &&
  (process.env.NEXT_PHASE === 'build' || process.env.NEXT_PHASE === 'phase-production-build');

export const handlers = {
  GET: async (req?: unknown) => {
    await initNextAuth();
    return (_nextAuth as { handlers: { GET: (r: unknown) => Promise<Response> } }).handlers.GET(req);
  },
  POST: async (req?: unknown) => {
    await initNextAuth();
    return (_nextAuth as { handlers: { POST: (r: unknown) => Promise<Response> } }).handlers.POST(req);
  },
};

let _signIn: () => Promise<void> = async () => {};
let _signOut: () => Promise<void> = async () => {};
export { _signIn as signIn, _signOut as signOut };

let _auth: (() => Promise<Session | null>) | null = null;
let _nextAuth: unknown = null;
let _initialized = false;
let _initPromise: Promise<void> | null = null;

async function initNextAuth() {
  if (_initialized) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const { authConfig } = await import('./config');
    const NextAuth = (await import('next-auth')).default;

    _nextAuth = NextAuth(authConfig);

    handlers.GET = (req: unknown) =>
      (_nextAuth as { handlers: { GET: (r: unknown) => Promise<Response> } }).handlers.GET(req);
    handlers.POST = (req: unknown) =>
      (_nextAuth as { handlers: { POST: (r: unknown) => Promise<Response> } }).handlers.POST(req);
    _signIn = () => (_nextAuth as { signIn: () => Promise<void> }).signIn();
    _signOut = () => (_nextAuth as { signOut: () => Promise<void> }).signOut();
    _auth = () => (_nextAuth as { auth: () => Promise<Session | null> }).auth();

    _initialized = true;
  })();

  return _initPromise;
}

/**
 * Session getter — used in Server Components and API routes.
 */
export async function auth(): Promise<Session | null> {
  if (IS_BUILD) return null;

  // Validate AUTH_SECRET at startup
  if (typeof process.env.AUTH_SECRET !== 'undefined') {
    validateAuthSecret();
  }

  await initNextAuth();

  if (_auth) {
    try {
      return await _auth();
    } catch (err) {
      console.warn('[Auth] Session fetch failed, returning null:', err);
      return null;
    }
  }

  return null;
}

/**
 * Middleware-compatible wrapper.
 * Usage: export default authMiddleware;
 */
export function authMiddleware(
  func: (req: { auth: Session | null; nextUrl: URL }) => Response | Promise<Response>
): (req: unknown) => Promise<Response> {
  return async (req: unknown) => {
    const nextUrl = new URL((req as { url?: string })?.url ?? '/', 'http://localhost');
    if (IS_BUILD) return func({ auth: null, nextUrl });
    await initNextAuth();
    // Pass the request so NextAuth reads cookies from req (required in Edge/middleware context)
    const session = await (_nextAuth as { auth: (r: unknown) => Promise<Session | null> }).auth(req);
    return func({ auth: session, nextUrl });
  };
}