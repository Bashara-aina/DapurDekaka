import type { Session } from 'next-auth';

const IS_BUILD =
  typeof process.env.NEXT_PHASE !== 'undefined' &&
  (process.env.NEXT_PHASE === 'build' || process.env.NEXT_PHASE === 'phase-production-build');

const stubResponse = () =>
  new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 });

export const handlers = {
  GET: async (_req?: unknown) => stubResponse(),
  POST: async (_req?: unknown) => stubResponse(),
};

let _signIn: () => Promise<void> = async () => {};
let _signOut: () => Promise<void> = async () => {};
export { _signIn as signIn, _signOut as signOut };

let _auth: (() => Promise<Session | null>) | null = null;
let _nextAuth: unknown = null;
let _initialized = false;

async function initNextAuth() {
  if (_initialized) return;

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
}

/**
 * Session getter — used in Server Components and API routes.
 */
export async function auth(): Promise<Session | null> {
  if (IS_BUILD) return null;

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
    if (IS_BUILD) return func({ auth: null, nextUrl: new URL((req as { url?: string })?.url ?? '/', 'http://localhost') });
    await initNextAuth();
    const session = _auth ? await _auth() : null;
    return func({ auth: session, nextUrl: new URL((req as { url?: string })?.url ?? '/', 'http://localhost') });
  };
}