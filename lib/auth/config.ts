import type { NextAuthConfig, Session } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import NextAuth from 'next-auth';
import { getDb, hasDbUrl, db } from '@/lib/db';
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/utils/logger';
import { logAdminActivity } from '@/lib/services/audit.service';

const ADMIN_ROLES = new Set(['superadmin', 'owner', 'warehouse']);

const googleId = process.env.AUTH_GOOGLE_ID;
const googleSecret = process.env.AUTH_GOOGLE_SECRET;
// Never throw at import: `next build` evaluates route modules with
// NODE_ENV=production but often without secrets (NEXT_PHASE=build).
// Missing creds disable Google OAuth (warn loudly); production runtime
// without creds is a deploy-config error, surfaced in logs + /api/health.
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
if ((!googleId || !googleSecret) && !isBuildPhase) {
  logger.warn('[auth] Google OAuth disabled — AUTH_GOOGLE_ID/SECRET not set');
}

// Empty-string env values count as missing (Next loads keys with empty
// values from .env* files; `??` alone would not catch them).
const AUTH_SECRET_RAW = process.env.AUTH_SECRET?.trim() || undefined;
const AUTH_SECRET =
  AUTH_SECRET_RAW ??
  (isBuildPhase || process.env.NODE_ENV !== 'production'
    ? 'dev-only-insecure-secret-min-32-chars-long'
    : undefined);
if (!AUTH_SECRET || AUTH_SECRET.length < 32) {
  throw new Error('AUTH_SECRET must be set and at least 32 characters long');
}

// Drizzle adapter is kept so Google OAuth account linking (the `accounts` table)
// continues to work. NextAuth v5's Credentials provider requires JWT sessions,
// so we set strategy: 'jwt' below and read role/isActive from the token.
// Lazily built: constructing it calls getDb(), which must not run during
// env-less `next build` route collection (hasDbUrl() is false there).
const adapter = (hasDbUrl() ? DrizzleAdapter(getDb()) : undefined) as Adapter | undefined;

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
  ...(adapter ? { adapter } : {}),
  secret: AUTH_SECRET,
  trustHost: true,
  pages: { signIn: '/login', error: '/login' },
  providers: [
    ...(googleId && googleSecret
      ? [
          Google({
            clientId: googleId,
            clientSecret: googleSecret,
          }),
        ]
      : []),
    Credentials({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
        // Optional TOTP code / backup code — required iff 2FA is enabled.
        totp: { type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.query.users.findFirst({
          where: eq(users.email, (credentials.email as string).toLowerCase()),
        });
        if (!user?.passwordHash) return null;
        if (!user.isActive) return null;
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        if (!isValid) return null;

        // TOTP 2FA gate (otplib v13, RFC 6238). Skipped entirely when the
        // user has not enabled 2FA — zero behaviour change for other users.
        // Fail CLOSED on crypto errors. OPERATIONS NOTE: rotating AUTH_SECRET
        // invalidates stored 2FA secrets (they are envelope-encrypted with it)
        // — affected users must re-enroll via backup-code… which also fails.
        // Keep an offline superadmin recovery path before rotating.
        if (user.twoFactorEnabled) {
          const { decryptTotpSecret, verifyTotpCode, consumeBackupCode } =
            await import('@/lib/auth/two-factor');
          const code =
            typeof credentials.totp === 'string' ? credentials.totp : '';
          if (!code) {
            logger.warn('[auth] 2FA code missing', { userId: user.id });
            return null;
          }
          let passed = false;
          try {
            if (user.twoFactorSecret) {
              const plaintext = decryptTotpSecret(user.twoFactorSecret);
              passed = await verifyTotpCode(plaintext, code);
            }
          } catch (err) {
            logger.error('[auth] 2FA secret decrypt failed', {
              userId: user.id,
              error: err instanceof Error ? err.message : String(err),
            });
            return null;
          }
          // Fall back to one-time backup codes (consumed on use).
          if (!passed) {
            const { valid, remaining } = await consumeBackupCode(
              user.twoFactorBackupCodes,
              code
            );
            if (valid) {
              passed = true;
              await db
                .update(users)
                .set({ twoFactorBackupCodes: remaining, updatedAt: new Date() })
                .where(eq(users.id, user.id));
            }
          }
          if (!passed) {
            logger.warn('[auth] 2FA code invalid', { userId: user.id });
            return null;
          }
        }

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
      const t = token as Record<string, unknown>;

      async function fetchTokenVersion(userId: string): Promise<number | undefined> {
        try {
          const result = await db.execute<{ token_version: number }>(
            sql`SELECT token_version FROM ${users} WHERE id = ${userId}`
          );
          return result.rows?.[0]?.token_version ?? 0;
        } catch {
          // Column doesn't exist yet (pre-migration). Default to 0.
          return 0;
        }
      }

      // On sign-in (both Credentials and OAuth) the `user` arg is populated.
      // Copy role, isActive, tokenVersion into the JWT so the session callback
      // can surface them.  tokenVersion lets us invalidate all existing sessions
      // when the user resets their password.
      if (user) {
        const u = user as AppSessionUser;
        if (u.id) token.sub = u.id;
        if (u.role) t.role = u.role;
        if (typeof u.isActive === 'boolean') t.isActive = u.isActive;
        if (u.id) t.tokenVersion = await fetchTokenVersion(u.id);
      }

      // When the client calls update() (e.g. after login), refresh role/isActive
      // and tokenVersion from the DB so deactivation / password-reset takes
      // effect on the next server round-trip.
      if (trigger === 'update' && (token.sub || t.userId)) {
        const userId = (token.sub || t.userId) as string;
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { role: true, isActive: true },
        });
        if (dbUser) {
          t.role = dbUser.role;
          t.isActive = dbUser.isActive;
        }
        t.tokenVersion = await fetchTokenVersion(userId);
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
  events: {
    /**
     * Fires after a successful sign-in (both Credentials and OAuth).
     * Non-blocking: failures here must never break the user's session.
     */
    async signIn({ user, account, isNewUser }) {
      try {
        if (!user?.id) return;
        logger.info('[auth] signIn', {
          userId: user.id,
          email: user.email,
          provider: account?.provider ?? 'unknown',
          isNewUser: Boolean(isNewUser),
        });

        // Only audit-log admin/staff sign-ins (customers are too noisy).
        const role = (user as { role?: string }).role;
        if (role && ADMIN_ROLES.has(role)) {
          await logAdminActivity({
            userId: user.id,
            action: isNewUser ? 'auth.signup_admin' : 'auth.signin_admin',
            targetType: 'user',
            targetId: user.id,
            afterState: { provider: account?.provider ?? 'unknown' },
          });
        }
      } catch (err) {
        logger.warn('[auth] signIn event handler failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },

    /** Fires on session destruction (sign-out, expiry, manual). */
    async signOut(message) {
      try {
        const userId =
          'token' in message && message.token
            ? (message.token as { sub?: string }).sub
            : undefined;
        if (!userId) return;
        logger.info('[auth] signOut', { userId });
        await logAdminActivity({
          userId,
          action: 'auth.signout',
          targetType: 'user',
          targetId: userId,
        });
      } catch (err) {
        logger.warn('[auth] signOut event handler failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  },
} as NextAuthConfig;

const { handlers, auth } = NextAuth(authConfig);

export { handlers, auth };

// Re-export so callers can type-narrow without importing next-auth directly.
export type { Session } from 'next-auth';