import type { Session } from 'next-auth';

const IS_BUILD =
  typeof process.env.NEXT_PHASE !== 'undefined' &&
  (process.env.NEXT_PHASE === 'build' || process.env.NEXT_PHASE === 'phase-production-build');

const stubResponse = () => new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 });

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

  const NextAuth = (await import('next-auth')).default;
  const { DrizzleAdapter } = await import('@auth/drizzle-adapter');
  const { db } = await import('@/lib/db');
  const bcrypt = (await import('bcryptjs')).default;
  const { users } = await import('@/lib/db/schema');
  const { eq } = await import('drizzle-orm');

  _nextAuth = NextAuth({
    adapter: DrizzleAdapter(db),
    trustHost: true,
    providers: [
      (await import('next-auth/providers/google')).default({
        clientId: process.env.AUTH_GOOGLE_ID ?? '',
        clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
      }),
      (await import('next-auth/providers/credentials')).default({
        credentials: {
          email: { type: 'email' },
          password: { type: 'password' },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) return null;
          const user = await db.query.users.findFirst({
            where: eq(users.email, credentials.email as string),
          });
          if (!user?.passwordHash) return null;
          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );
          if (!isValid) return null;
          return { id: user.id, email: user.email, name: user.name, role: user.role };
        },
      }),
    ],
    session: { strategy: 'database' },
    callbacks: {
      async jwt({ token, user }) {
        if (user?.id) {
          token.role = (user as { role?: string }).role ?? 'customer';
          token.sub = user.id;
        }
        return token;
      },
      async session({ session, user }) {
        if (!session.user) return session;
        if (user?.id) {
          session.user.id = user.id as string;
          const role = (user as { role?: string }).role;
          if (typeof role === 'string' && role.length > 0) {
            session.user.role = role;
          }
        }
        return session;
      },
    },
    pages: { signIn: '/login', error: '/login' },
  });

  // Update handlers with real NextAuth handlers
  handlers.GET = (req: unknown) => (_nextAuth as { handlers: { GET: (r: unknown) => Promise<Response> } }).handlers.GET(req);
  handlers.POST = (req: unknown) => (_nextAuth as { handlers: { POST: (r: unknown) => Promise<Response> } }).handlers.POST(req);
  _signIn = () => (_nextAuth as { signIn: () => Promise<void> }).signIn();
  _signOut = () => (_nextAuth as { signOut: () => Promise<void> }).signOut();
  _auth = () => (_nextAuth as { auth: () => Promise<Session | null> }).auth();

  _initialized = true;
}

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