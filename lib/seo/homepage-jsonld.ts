import { getSetting } from '@/lib/settings/get-settings';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export async function buildOrganizationJsonLd(contact: {
  whatsapp: string;
  instagramUrl: string;
}): Promise<Record<string, unknown>> {
  const [tokopediaUrl, shopeeUrl, logoUrl, city, province, storeName] = await Promise.all([
    getSetting<string>('tokopedia_url').catch(() => null),
    getSetting<string>('shopee_url').catch(() => null),
    getSetting<string>('seo_logo_url').catch(() => null),
    getSetting<string>('store_city').catch(() => null),
    getSetting<string>('store_province').catch(() => null),
    getSetting<string>('store_name').catch(() => null),
  ]);

  const sameAs: string[] = [];
  if (contact.instagramUrl) sameAs.push(contact.instagramUrl);
  if (tokopediaUrl) sameAs.push(tokopediaUrl);
  if (shopeeUrl) sameAs.push(shopeeUrl);

  const finalLogo = logoUrl ?? (SITE_URL ? `${SITE_URL}/assets/logo/logo.png` : '');

  const result: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: storeName || 'Dapur Dekaka',
    alternateName: '德卡',
    url: SITE_URL || 'https://dapurdekaka.com',
    logo: finalLogo,
    description:
      'Premium Chinese-Indonesian frozen food. Dimsum, siomay, bakso, lumpia. 100% halal.',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: contact.whatsapp,
      availableLanguage: ['Indonesian', 'English', 'Chinese'],
      url: contact.whatsapp ? `https://wa.me/${contact.whatsapp}` : undefined,
    },
  };

  if (city || province) {
    result.foundingLocation = {
      '@type': 'Place',
      ...(city ? { addressLocality: city } : {}),
      ...(province ? { addressRegion: province } : {}),
      addressCountry: 'ID',
    };
  }

  if (sameAs.length > 0) {
    result.sameAs = sameAs;
  }

  return result;
}

export function buildWebsiteJsonLd(): Record<string, unknown> {
  const url = SITE_URL || 'https://dapurdekaka.com';
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Dapur Dekaka',
    url,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${url}/products?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export async function buildLocalBusinessJsonLd(input: {
  whatsapp: string;
  address: string;
  priceMin: number;
  priceMax: number;
}): Promise<Record<string, unknown>> {
  const [
    postalCode,
    latRaw,
    lngRaw,
    openingHours,
    openDays,
    sundayHours,
    logoUrl,
    city,
    province,
  ] = await Promise.all([
    getSetting<string>('biteship_origin_postal_code').catch(() => null),
    getSetting<string>('biteship_origin_lat').catch(() => null),
    getSetting<string>('biteship_origin_lng').catch(() => null),
    getSetting<string>('store_opening_hours').catch(() => null),
    getSetting<string>('store_open_days').catch(() => null),
    getSetting<string>('store_sunday_hours').catch(() => null),
    getSetting<string>('seo_logo_url').catch(() => null),
    getSetting<string>('store_city').catch(() => null),
    getSetting<string>('store_province').catch(() => null),
  ]);

  const url = SITE_URL || 'https://dapurdekaka.com';
  const finalLogo = logoUrl ?? (SITE_URL ? `${SITE_URL}/assets/logo/logo.png` : '');

  const openingHoursSpecification: Array<Record<string, unknown>> = [];

  const parseTimeRange = (raw: string | null | undefined): { opens: string; closes: string } | null => {
    if (!raw) return null;
    const match = raw.match(/(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})/);
    if (!match) return null;
    return {
      opens: `${match[1]!.padStart(2, '0')}:${match[2]}`,
      closes: `${match[3]!.padStart(2, '0')}:${match[4]}`,
    };
  };

  const mapDays = (days: string | null | undefined): string[] => {
    if (!days) return [];
    const mapping: Record<string, string> = {
      senin: 'Monday',
      selasa: 'Tuesday',
      rabu: 'Wednesday',
      kamis: 'Thursday',
      jumat: 'Friday',
      sabtu: 'Saturday',
      minggu: 'Sunday',
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday',
    };
    const result: string[] = [];
    const parts = days.toLowerCase().split(/[,/&\-]|dan/i);
    for (const p of parts) {
      const trimmed = p.trim();
      if (trimmed && mapping[trimmed]) result.push(mapping[trimmed]!);
    }
    return result;
  };

  const weekdayDays = mapDays(openDays);
  const weekdayRange = parseTimeRange(openingHours);
  if (weekdayDays.length > 0 && weekdayRange) {
    openingHoursSpecification.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: weekdayDays,
      opens: weekdayRange.opens,
      closes: weekdayRange.closes,
    });
  }

  const sundayRange = parseTimeRange(sundayHours);
  if (sundayRange) {
    openingHoursSpecification.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Sunday'],
      opens: sundayRange.opens,
      closes: sundayRange.closes,
    });
  }

  const result: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${url}/#business`,
    name: 'Dapur Dekaka',
    description:
      'Produsen dan toko online frozen food premium Chinese-Indonesia.',
    url,
    logo: finalLogo,
    telephone: input.whatsapp,
    priceRange: `Rp ${input.priceMin.toLocaleString('id-ID')} - Rp ${input.priceMax.toLocaleString('id-ID')}`,
    currenciesAccepted: 'IDR',
    paymentAccepted: 'Credit Card, Bank Transfer, E-Wallet',
    servesCuisine: ['Chinese', 'Indonesian', 'Chinese-Indonesian'],
    hasMenu: `${url}/products`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: input.address || '',
      addressLocality: city || '',
      addressRegion: province || '',
      ...(postalCode ? { postalCode } : {}),
      addressCountry: 'ID',
    },
  };

  if (latRaw && lngRaw) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      result.geo = {
        '@type': 'GeoCoordinates',
        latitude: lat,
        longitude: lng,
      };
    }
  }

  if (openingHoursSpecification.length > 0) {
    result.openingHoursSpecification = openingHoursSpecification;
  }

  return result;
}