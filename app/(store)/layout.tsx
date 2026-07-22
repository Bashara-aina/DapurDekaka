import type { Metadata } from 'next';
import { Navbar } from '@/components/store/layout/Navbar';
import { BottomNav } from '@/components/store/layout/BottomNav';
import Footer from '@/components/store/layout/Footer';
import { WhatsAppButton } from '@/components/store/layout/WhatsAppButton';
import { SoftLaunchBanner } from '@/components/store/layout/SoftLaunchBanner';
import { getSetting } from '@/lib/settings/get-settings';
import { isFlagEnabled } from '@/lib/config/feature-flags';
import { resolveWhatsAppNumber } from '@/lib/utils/whatsapp-number';

export async function generateMetadata(): Promise<Metadata> {
  if (!isFlagEnabled('softLaunch')) return {};
  return {
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const dbWhatsapp = await getSetting<string>('store_whatsapp_number').catch(() => null);
  const whatsappNumber = resolveWhatsAppNumber(dbWhatsapp);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-red focus:text-white focus:rounded-button focus:shadow-lg"
      >
        Langsung ke konten utama
      </a>
      <SoftLaunchBanner />
      <Navbar />
      <main id="main-content" className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
      <Footer />
      <WhatsAppButton whatsappNumber={whatsappNumber} />
      <BottomNav />
    </>
  );
}
