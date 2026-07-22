import { Navbar } from '@/components/store/layout/Navbar';
import Footer from '@/components/store/layout/Footer';
import { WhatsAppButton } from '@/components/store/layout/WhatsAppButton';
import { Providers } from '../(store)/providers';
import { getSetting } from '@/lib/settings/get-settings';

export default async function B2BLayout({ children }: { children: React.ReactNode }) {
  const whatsappNumber = await getSetting('store_whatsapp_number');

  return (
    <Providers>
      <Navbar />
      <main className="min-h-screen pb-20 md:pb-0">{children}</main>
      <Footer />
      <WhatsAppButton whatsappNumber={whatsappNumber ?? undefined} />
    </Providers>
  );
}