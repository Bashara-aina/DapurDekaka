import { getSetting } from '@/lib/settings/get-settings';
import { SETTING_KEYS } from '@/lib/settings/canonical-keys';
import { logger } from '@/lib/utils/logger';

/**
 * Single source of truth for the store WhatsApp number.
 * Prefers DB `store_whatsapp_number`, falls back to `NEXT_PUBLIC_WHATSAPP_NUMBER`.
 * Logs loudly when empty so ops alerts are never silently skipped.
 */
export async function resolveStoreWhatsAppNumber(): Promise<string> {
  const fromDb = await getSetting<string>(SETTING_KEYS.STORE_WHATSAPP_NUMBER).catch(() => null);
  const fromEnv = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() || '';
  const number = (fromDb?.trim() || fromEnv).replace(/^\+/, '');

  if (!number) {
    logger.error('[store-whatsapp] No WhatsApp number configured', {
      hasDb: Boolean(fromDb),
      hasEnv: Boolean(fromEnv),
    });
  }

  return number;
}

/**
 * Sync resolver for client components that only have the public env var.
 * Prefer `resolveStoreWhatsAppNumber` on the server.
 */
export function resolveStoreWhatsAppNumberSync(dbOrProp?: string | null): string {
  const fromProp = dbOrProp?.trim() || '';
  const fromEnv = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() || '';
  return (fromProp || fromEnv).replace(/^\+/, '');
}
