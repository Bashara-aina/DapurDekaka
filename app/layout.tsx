import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import { Providers } from '@/components/Providers';
import { Analytics } from '@vercel/analytics/next';
import { getSetting } from '@/lib/settings/get-settings';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Dapur Dekaka | Frozen Food Premium dari Bandung',
    template: '%s | Dapur Dekaka',
  },
  description: 'Cita rasa warisan Chinese-Indonesia, kini di rumahmu. Dimsum, siomay, bakso frozen premium dari Bandung. Pesan online, kirim ke seluruh Indonesia.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
      { url: '/assets/logo/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/assets/logo/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/assets/logo/apple-touch-icon.png',
  },
};

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [storeName, instagramUrl, logoUrl] = await Promise.all([
    getSetting<string>('store_name').catch(() => null),
    getSetting<string>('instagram_url').catch(() => null),
    getSetting<string>('seo_logo_url').catch(() => null),
  ]);

  const finalLogo = logoUrl ?? (SITE_URL ? `${SITE_URL}/assets/logo/logo.png` : '');
  const url = SITE_URL || 'https://dapurdekaka.com';

  const sameAs: string[] = [];
  if (instagramUrl) sameAs.push(instagramUrl);

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: storeName ?? '',
    url,
    logo: finalLogo,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: 'Indonesian',
    },
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };

  return (
    <html lang="id" className={`${playfair.variable} ${inter.variable}`}>
      <body className="font-body antialiased bg-brand-cream text-text-primary">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}