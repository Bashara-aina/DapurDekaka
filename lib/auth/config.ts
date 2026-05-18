import type { NextAuthConfig } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// #region agent debug log
fetch('http://127.0.0.1:7420/ingest/09d39df7-998a-468e-966d-456351968e13', {method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'38c573'},body:JSON.stringify({sessionId:'38c573',location:'lib/auth/config.ts:11',message:'config module loaded',data:{hasDb:!!db,hasGoogleId:!!process.env.AUTH_GOOGLE_ID,hasAuthSecret:!!process.env.AUTH_SECRET},timestamp:Date.now()})}).catch(()=>{});
// #endregion

let adapter: Adapter;
try {
  adapter = DrizzleAdapter(db) as Adapter;
  // #region agent debug log
  fetch('http://127.0.0.1:7420/ingest/09d39df7-998a-468e-966d-456351968e13', {method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'38c573'},body:JSON.stringify({sessionId:'38c573',location:'lib/auth/config.ts:19',message:'DrizzleAdapter created successfully',data:{},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
} catch (err) {
  // #region agent debug log
  fetch('http://127.0.0.1:7420/ingest/09d39df7-998a-468e-966d-456351968e13', {method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'38c573'},body:JSON.stringify({sessionId:'38c573',location:'lib/auth/config.ts:23',message:'DrizzleAdapter FAILED',data:{error:String(err)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  throw err;
}

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