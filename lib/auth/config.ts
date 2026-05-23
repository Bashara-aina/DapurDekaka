import type { NextAuthConfig, Session } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import NextAuth from 'next-auth';
import { db } from '@/lib/db';
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const googleId = process.env.AUTH_GOOGLE_ID;
const googleSecret = process.env.AUTH_GOOGLE_SECRET;
if (!googleId || !googleSecret) {
  throw new Error('AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET must be set');
}

// DrizzleAdapter expects specific table column names; our schema uses camelCase throughout.
// These type assertions are safe at runtime — the adapter accesses columns by name string.
const adapter = DrizzleAdapter(db, {
  usersTable: users,
  // @ts-expect-error – DrizzleAdapter accountsTable schema differs from our camelCase columns
  accountsTable: accounts,
  // @ts-expect-error – DrizzleAdapter sessionsTable schema differs from our id PK
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
}) as Adapter;

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
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  session: { strategy: 'database', secure: process.env.NODE_ENV === 'production' },
  callbacks: {
    async session({ session, user }) {
      if (!session.user) return session;
      if (user?.id) {
        session.user.id = user.id as string;
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, user.id),
          columns: { role: true, isActive: true, name: true },
        });
        if (!dbUser) {
          return null as unknown as Session;
        }
        if (dbUser.role) {
          session.user.role = dbUser.role;
        }
        if (dbUser.isActive === false) {
          // Distinguish "inactive user" from "not logged in" — return session with flag
          session.user.isActive = false;
        }
      }
      return session;
    },
  },
} as NextAuthConfig;

const { handlers, auth } = NextAuth(authConfig);

export { handlers, auth };