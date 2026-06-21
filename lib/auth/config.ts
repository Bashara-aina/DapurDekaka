import type { NextAuthConfig, Session } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import NextAuth from 'next-auth';
import { getDb, db } from '@/lib/db';
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const googleId = process.env.AUTH_GOOGLE_ID;
const googleSecret = process.env.AUTH_GOOGLE_SECRET;
if (!googleId || !googleSecret) {
  throw new Error('AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET must be set');
}

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  throw new Error('AUTH_SECRET must be set and at least 32 characters long');
}

// Drizzle adapter is kept so Google OAuth account linking (the `accounts` table)
// continues to work. NextAuth v5's Credentials provider requires JWT sessions,
// so we set strategy: 'jwt' below and read role/isActive from the token.
const adapter = DrizzleAdapter(getDb()) as Adapter;

// Shape we attach to the JWT and surface on session.user
interface AppSessionUser {
  id?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  role?: string;
  isActive?: boolean;
}

export const authConfig = {
  adapter,
  trustHost: true,
  pages: { signIn: '/login', error: '/login' },
  providers: [
    Google({
      clientId: googleId,
      clientSecret: googleSecret,
    }),
    Credentials({
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
        if (!user.isActive) return null;
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
        };
      },
    }),
  ],
  // Credentials provider in NextAuth v5 requires JWT strategy.
  // Drizzle adapter still handles Google OAuth account linking at sign-in.
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30, secure: process.env.NODE_ENV === 'production' },
  callbacks: {
    async jwt({ token, user, trigger, session: updateData }) {
      // On sign-in (both Credentials and OAuth) the `user` arg is populated.
      // Copy role + isActive into the JWT so the session callback can surface them.
      if (user) {
        const u = user as AppSessionUser;
        if (u.id) token.sub = u.id;
        if (u.role) (token as Record<string, unknown>).role = u.role;
        if (typeof u.isActive === 'boolean') (token as Record<string, unknown>).isActive = u.isActive;
      }

      // When the client calls update() (e.g. after login), refresh role/isActive
      // from the DB so a deactivated user is reflected on the next request.
      if (trigger === 'update' && (token.sub || (token as Record<string, unknown>).userId)) {
        const userId = (token.sub || (token as Record<string, unknown>).userId) as string;
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { role: true, isActive: true },
        });
        if (dbUser) {
          (token as Record<string, unknown>).role = dbUser.role;
          (token as Record<string, unknown>).isActive = dbUser.isActive;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (!session.user) return session;
      const t = token as Record<string, unknown>;
      if (typeof t.sub === 'string') {
        session.user.id = t.sub;
      }
      if (typeof t.role === 'string') {
        session.user.role = t.role;
      }
      if (typeof t.isActive === 'boolean') {
        session.user.isActive = t.isActive;
      }
      return session;
    },
  },
} as NextAuthConfig;

const { handlers, auth } = NextAuth(authConfig);

export { handlers, auth };

// Re-export so callers can type-narrow without importing next-auth directly.
export type { Session } from 'next-auth';