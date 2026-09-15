export function resolveWhatsAppNumber(dbValue?: string | null): string | undefined {
  if (dbValue && dbValue.trim().length > 0) {
    return dbValue;
  }
  return undefined;
}