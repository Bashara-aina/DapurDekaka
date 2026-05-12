import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import { Providers } from '@/components/Providers';
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
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/assets/icons/favicon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${playfair.variable} ${inter.variable}`}>
      <body className="font-body antialiased bg-brand-cream text-text-primary">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
