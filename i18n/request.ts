import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async () => {
  // Use requestLocale when available (next-intl 3.22+), otherwise fall back to default locale
  // Note: This version of next-intl uses locale routing, so we trust the routing default
  const locale = routing.defaultLocale;

  return {
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});