import { Navbar } from '@/components/store/layout/Navbar';
import { BottomNav } from '@/components/store/layout/BottomNav';
import { Footer } from '@/components/store/layout/Footer';
import { WhatsAppButton } from '@/components/store/layout/WhatsAppButton';
import { getSetting } from '@/lib/settings/get-settings';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const whatsappNumber = await getSetting('store_whatsapp_number');

  return (
    <>
      <Navbar />
      <main className="min-h-screen pb-20 md:pb-0">{children}</main>
      <Footer />
      <WhatsAppButton whatsappNumber={whatsappNumber ?? undefined} />
      <BottomNav />
    </>
  );
}
