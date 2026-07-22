/**
 * Resolve the public WhatsApp number for store CTAs.
 * Prefer the DB setting unless it is still the seed placeholder.
 */
const PLACEHOLDER_WA = '6281234567890';

export function resolveWhatsAppNumber(dbValue?: string | null): string | undefined {
  const envWhatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  if (dbValue && dbValue !== PLACEHOLDER_WA) {
    return dbValue;
  }
  return envWhatsapp ?? dbValue ?? undefined;
}
