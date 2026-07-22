import { Navbar } from '@/components/store/layout/Navbar';
import Footer from '@/components/store/layout/Footer';
import { WhatsAppButton } from '@/components/store/layout/WhatsAppButton';
import { getSetting } from '@/lib/settings/get-settings';
import { resolveWhatsAppNumber } from '@/lib/utils/whatsapp-number';

export default async function B2BLayout({ children }: { children: React.ReactNode }) {
  const dbWhatsapp = await getSetting<string>('store_whatsapp_number').catch(() => null);
  const whatsappNumber = resolveWhatsAppNumber(dbWhatsapp);

  return (
    <>
      <Navbar />
      <main className="min-h-screen pb-20 md:pb-0">{children}</main>
      <Footer />
      <WhatsAppButton whatsappNumber={whatsappNumber} />
    </>
  );
}