import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

type AppLocale = (typeof routing.locales)[number];

function isAppLocale(value: string | undefined): value is AppLocale {
  return !!value && (routing.locales as readonly string[]).includes(value);
}

export default getRequestConfig(async ({ requestLocale }) => {
  // No [locale] segment and no locale middleware: the locale comes from the
  // NEXT_LOCALE cookie set by LanguageSwitcher, falling back to the default.
  // Read the cookie only when the page didn't set a locale, so pages that call
  // setRequestLocale() can still render statically.
  const requested = await requestLocale;
  let locale: AppLocale = routing.defaultLocale;
  if (isAppLocale(requested)) {
    locale = requested;
  } else {
    const cookieLocale = cookies().get('NEXT_LOCALE')?.value;
    if (isAppLocale(cookieLocale)) locale = cookieLocale;
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
