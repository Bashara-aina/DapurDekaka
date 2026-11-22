import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Navbar } from '@/components/store/layout/Navbar';
import { BottomNav } from '@/components/store/layout/BottomNav';
import Footer from '@/components/store/layout/Footer';
import { WhatsAppButton } from '@/components/store/layout/WhatsAppButton';
import { SoftLaunchBanner } from '@/components/store/layout/SoftLaunchBanner';
import { getSetting } from '@/lib/settings/get-settings';
import { isFlagEnabled } from '@/lib/config/feature-flags';
import { isMaintenanceMode } from '@/lib/ops/maintenance';
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
  // DB-backed admin toggle (Node). Env kill-switch is handled in middleware.
  // Skip /maintenance to avoid redirect loops. DB errors fail-open.
  const pathname = (await headers()).get('x-pathname') ?? '';
  if (
    !pathname.startsWith('/maintenance') &&
    (await isMaintenanceMode().catch(() => false))
  ) {
    redirect('/maintenance');
  }

  const [dbWhatsapp, softLaunchEnabled, softLaunchMsg] = await Promise.all([
    getSetting<string>('store_whatsapp_number').catch(() => null),
    getSetting<boolean>('soft_launch_banner_enabled', 'boolean').catch(() => true),
    getSetting<string>('soft_launch_wa_message').catch(() => null),
  ]);
  const whatsappNumber = resolveWhatsAppNumber(dbWhatsapp);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-red focus:text-white focus:rounded-button focus:shadow-lg"
      >
        Langsung ke konten utama
      </a>
      <SoftLaunchBanner
        enabledFromSettings={softLaunchEnabled !== false}
        whatsappNumber={whatsappNumber}
        waMessage={softLaunchMsg ?? undefined}
      />
      <Navbar />
      <main id="main-content" className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
      <Footer />
      <WhatsAppButton whatsappNumber={whatsappNumber} />
      <BottomNav />
    </>
  );
}
