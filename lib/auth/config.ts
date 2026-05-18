import type { NextAuthConfig } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const adapter = DrizzleAdapter(db) as Adapter;

export const authConfig: NextAuthConfig = {
  adapter,
  trustHost: true,
  pages: { signIn: '/login', error: '/login' },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
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
  session: { strategy: 'database' },
  callbacks: {
    async session({ session, user }) {
      if (!session.user) return session;
      if (user?.id) {
        session.user.id = user.id as string;
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, user.id),
          columns: { role: true, isActive: true },
        });
        if (dbUser?.role) {
          session.user.role = dbUser.role;
        }
        if (dbUser?.isActive === false) {
          return {} as typeof session;
        }
      }
      return session;
    },
  },
};