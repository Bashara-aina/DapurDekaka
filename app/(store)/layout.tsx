import type { Metadata } from 'next';
import { Navbar } from '@/components/store/layout/Navbar';
import { BottomNav } from '@/components/store/layout/BottomNav';
import Footer from '@/components/store/layout/Footer';
import { WhatsAppButton } from '@/components/store/layout/WhatsAppButton';
import { SoftLaunchBanner } from '@/components/store/layout/SoftLaunchBanner';
import { getSetting } from '@/lib/settings/get-settings';
import { isFlagEnabled } from '@/lib/config/feature-flags';

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
  const whatsappNumber = await getSetting('store_whatsapp_number').catch(() => null);
  const softLaunch = isFlagEnabled('softLaunch');

  return (
    <>
      {softLaunch ? (
        <meta name="robots" content="noindex,nofollow" />
      ) : null}
      <SoftLaunchBanner />
      <Navbar />
      <main className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
      <Footer />
      <WhatsAppButton whatsappNumber={whatsappNumber ?? undefined} />
      <BottomNav />
    </>
  );
}
