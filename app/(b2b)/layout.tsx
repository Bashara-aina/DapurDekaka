import { Playfair_Display, Inter } from 'next/font/google';
import { Navbar } from '@/components/store/layout/Navbar';
import { Footer } from '@/components/store/layout/Footer';
import { WhatsAppButton } from '@/components/store/layout/WhatsAppButton';
import { Providers } from '../(store)/providers';
import '../globals.css';

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

export default function B2BLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${playfair.variable} ${inter.variable} font-body antialiased`}>
        <Providers>
          <Navbar />
          <main className="min-h-screen pb-20 md:pb-0">{children}</main>
          <Footer />
          <WhatsAppButton />
        </Providers>
      </body>
    </html>
  );
}