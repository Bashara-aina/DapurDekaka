import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { requireSuperadmin } from '@/lib/auth/require-admin';
import { success, serverError } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * BLOCKER 4: superadmin-only configuration health report.
 *
 * Reports PRESENCE ONLY — never values. This surfaces production env drift
 * (e.g. NEXT_PUBLIC_APP_URL pointing at localhost, missing FONNTE_API_KEY)
 * before it silently breaks payments or notifications.
 */
const REQUIRED_ENV = [
  'DATABASE_URL',
  'AUTH_SECRET',
  'AUTH_URL',
  'CRON_SECRET',
  'MIDTRANS_SERVER_KEY',
  'NEXT_PUBLIC_MIDTRANS_CLIENT_KEY',
  'MIDTRANS_IS_PRODUCTION',
  'BITESHIP_API_KEY',
  'BITESHIP_WEBHOOK_SECRET',
  'FONNTE_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'RESEND_API_KEY',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
  'NEXT_PUBLIC_APP_URL',
  'SENTRY_DSN',
] as const;

const REQUIRED_SETTINGS = [
  'biteship_origin_lat',
  'biteship_origin_lng',
  'biteship_origin_address',
  'store_address',
  'store_opening_hours',
  'admin_email',
] as const;

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireSuperadmin();
    if (!('user' in authResult)) {
      return authResult;
    }

    const env = REQUIRED_ENV.map((key) => {
      const value = process.env[key];
      const present = Boolean(value && value.trim().length > 0);
      return {
        key,
        present,
        hint:
          key === 'NEXT_PUBLIC_APP_URL' && present && value?.includes('localhost')
            ? 'points to localhost'
            : key === 'MIDTRANS_IS_PRODUCTION' && present && value !== 'true'
              ? 'set "true" for production'
              : undefined,
      };
    });

    const settingRows = await db
      .select({ key: systemSettings.key })
      .from(systemSettings)
      .where(inArray(systemSettings.key, [...REQUIRED_SETTINGS]));
    const presentSettingKeys = new Set(settingRows.map((row) => row.key));

    const settings = REQUIRED_SETTINGS.map((key) => ({
      key,
      present: presentSettingKeys.has(key),
    }));

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const issues = [
      ...env.filter((e) => !e.present).map((e) => `env:${e.key}`),
      ...env.filter((e) => e.hint === 'points to localhost').map((e) => `env:${e.key}:localhost`),
      ...settings.filter((s) => !s.present).map((s) => `setting:${s.key}`),
    ];

    return success({
      ok: issues.length === 0,
      appUrl,
      issues,
      env,
      settings,
    });
  } catch (error) {
    logger.error('[admin/health/config]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return serverError(error);
  }
}
